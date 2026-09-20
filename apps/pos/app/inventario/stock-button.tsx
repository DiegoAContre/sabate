'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Product } from '@/db/schema';
import { Modal } from '../modal';

export function StockButton({ product }: { product: Product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState<'recepcion' | 'ajuste'>('recepcion');
  const [quantity, setQuantity] = useState('1');
  const [newStock, setNewStock] = useState('');
  const [note, setNote] = useState('');

  function openModal() {
    setReason('recepcion');
    setQuantity('1');
    setNewStock(product.stock.toString());
    setNote('');
    setError('');
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const body =
      reason === 'recepcion'
        ? { reason, quantity: Number(quantity), note: note || undefined }
        : { reason, newStock: Number(newStock), note: note || undefined };
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'No se pudo registrar el movimiento');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('No se pudo registrar el movimiento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Stock
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Movimiento de stock">
        <p className="mb-3 text-sm text-gray-600">
          {product.name} — stock actual: <strong>{product.stock}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="reason"
                checked={reason === 'recepcion'}
                onChange={() => setReason('recepcion')}
              />
              Recepción
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="reason"
                checked={reason === 'ajuste'}
                onChange={() => setReason('ajuste')}
              />
              Ajuste (conteo)
            </label>
          </div>
          {reason === 'recepcion' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">
                ¿Cuántas unidades llegaron?
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Stock total contado
              </label>
              <input
                type="number"
                min="0"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                Delta registrado: {Number(newStock) - product.stock >= 0 ? '+' : ''}
                {Number(newStock) - product.stock}
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Nota <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
