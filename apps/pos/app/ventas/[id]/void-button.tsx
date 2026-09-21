'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/app/modal';

export function VoidButton({
  saleId,
  total,
}: {
  saleId: string;
  total: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/${saleId}/void`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'No se pudo anular la venta');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('No se pudo anular la venta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        Anular venta
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anular venta"
        message={`Se repondrá el stock y la venta de ${total} quedará marcada como anulada (no se borra del historial).`}
        confirmLabel="Anular"
        danger
        loading={loading}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
}
