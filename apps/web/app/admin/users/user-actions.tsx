'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { Role, User } from '@/lib/types';
import { ConfirmDialog } from '../modal';

export function UserActions({ user }: { user: User }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [pending, setPending] = useState<{ role?: Role; isActive?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleChange = pending?.role;
  const activeChange = pending?.isActive;

  async function handleConfirm() {
    if (!pending) return;
    setLoading(true);
    setError('');
    try {
      await apiClient(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify(pending),
      });
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  }

  let title = 'Confirm';
  let message = '';
  let danger = false;
  let confirmLabel = 'Confirm';
  if (roleChange) {
    title = 'Change role';
    message = `Change role of ${user.name} from "${user.role}" to "${roleChange}"?`;
  } else if (activeChange !== undefined) {
    title = activeChange ? 'Activate user' : 'Deactivate user';
    message = activeChange
      ? `Reactivate ${user.name}?`
      : `Deactivate ${user.name}? They will no longer be able to sign in.`;
    danger = !activeChange;
    confirmLabel = activeChange ? 'Activate' : 'Deactivate';
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <select
        value={roleChange ?? user.role}
        onChange={(e) => {
          const value = e.target.value as Role;
          if (value !== user.role) setPending({ role: value });
        }}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <button
        type="button"
        onClick={() => setPending({ isActive: !user.isActive })}
        className="text-sm text-gray-600 underline"
      >
        {user.isActive ? 'Deactivate' : 'Activate'}
      </button>
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        danger={danger}
        loading={loading}
        error={error}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
