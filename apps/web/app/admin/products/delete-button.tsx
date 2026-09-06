'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';

export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this product?')) return;
    setLoading(true);
    try {
      await apiClient(`/api/admin/products/${id}`, {
        method: 'DELETE',
        token: session?.accessToken,
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
