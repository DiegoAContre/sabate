'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/app/modal';

export function UserStatusButton({
  userId,
  username,
  isActive,
}: {
  userId: string;
  username: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'No se pudo actualizar el usuario');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('No se pudo actualizar el usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
      >
        {isActive ? 'Desactivar' : 'Activar'}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={isActive ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          isActive
            ? `${username} no podrá iniciar sesión. Sus ventas quedan en el historial.`
            : `${username} podrá volver a iniciar sesión.`
        }
        confirmLabel={isActive ? 'Desactivar' : 'Activar'}
        danger={isActive}
        loading={loading}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
}
