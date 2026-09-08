'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import { ConfirmDialog } from '../modal';

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      await apiClient(`/api/admin/products/${id}`, {
        method: 'DELETE',
        token: session?.accessToken,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete product"
        message={`Delete "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={loading}
        error={error}
        onConfirm={handleDelete}
      />
    </>
  );
}
