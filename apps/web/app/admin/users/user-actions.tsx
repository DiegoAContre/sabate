'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { Role, User } from '@/lib/types';

export function UserActions({ user }: { user: User }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function patch(fields: { role?: Role; isActive?: boolean }) {
    setLoading(true);
    try {
      await apiClient(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify(fields),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <select
        value={user.role}
        onChange={(e) => patch({ role: e.target.value as Role })}
        disabled={loading}
        className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <button
        type="button"
        onClick={() => patch({ isActive: !user.isActive })}
        disabled={loading}
        className="text-sm text-gray-600 underline disabled:opacity-50"
      >
        {user.isActive ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );
}
