'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Product } from '@/db/schema';
import { ConfirmDialog } from '../modal';

export function DeactivateButton({ product }: { product: Product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'No se pudo actualizar el producto');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('No se pudo actualizar el producto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          product.isActive
            ? 'rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50'
            : 'rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100'
        }
      >
        {product.isActive ? 'Desactivar' : 'Activar'}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={product.isActive ? 'Desactivar producto' : 'Activar producto'}
        message={
          product.isActive
            ? `¿Desactivar "${product.name}"? Dejará de aparecer en el punto de venta.`
            : `¿Activar "${product.name}"? Volverá a aparecer en el punto de venta.`
        }
        confirmLabel={product.isActive ? 'Desactivar' : 'Activar'}
        danger={product.isActive}
        loading={loading}
        error={error}
        onConfirm={handleConfirm}
      />
    </>
  );
}
