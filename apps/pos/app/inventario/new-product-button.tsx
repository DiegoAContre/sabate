'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Brand, Category } from '@/db/schema';
import { Modal } from '../modal';

interface SizeRow {
  size: string;
  quantity: string;
}

const emptySize = (): SizeRow => ({ size: '', quantity: '0' });

export function NewProductButton({
  categories,
  brands,
}: {
  categories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    categoryId: '',
    brandId: '',
    price: '',
    lowStockThreshold: '5',
  });
  const [sizes, setSizes] = useState<SizeRow[]>([emptySize()]);

  function reset() {
    setForm({
      name: '',
      code: '',
      categoryId: '',
      brandId: '',
      price: '',
      lowStockThreshold: '5',
    });
    setSizes([emptySize()]);
    setError('');
  }

  function setSizeRow(i: number, patch: Partial<SizeRow>) {
    setSizes((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Math.round(parseFloat(form.price) * 100);
    if (!Number.isFinite(price) || price < 0) {
      setError('Precio inválido');
      return;
    }
    const cleanSizes = sizes
      .filter((s) => s.size.trim())
      .map((s) => ({ size: s.size.trim(), quantity: Number(s.quantity) || 0 }));
    if (cleanSizes.length === 0) {
      setError('Agrega al menos una talla');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          code: form.code.trim() || null,
          categoryId: form.categoryId || null,
          brandId: form.brandId || null,
          price,
          lowStockThreshold: Number(form.lowStockThreshold),
          sizes: cleanSizes,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'No se pudo crear el producto');
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('No se pudo crear el producto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
      >
        Nuevo producto
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo producto">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Código{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Categoría{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Marca <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="">Sin marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Precio ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Umbral de stock bajo
              </label>
              <input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) =>
                  setForm({ ...form, lowStockThreshold: e.target.value })
                }
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tallas y existencias
            </label>
            <div className="space-y-2">
              {sizes.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.size}
                    onChange={(e) => setSizeRow(i, { size: e.target.value })}
                    placeholder="Talla (S, M, 32…)"
                    className="flex-1 rounded border border-gray-300 px-3 py-2"
                  />
                  <input
                    type="number"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => setSizeRow(i, { quantity: e.target.value })}
                    className="w-24 rounded border border-gray-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSizes((rows) =>
                        rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
                      )
                    }
                    disabled={sizes.length === 1}
                    className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSizes((rows) => [...rows, emptySize()])}
              className="mt-2 rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              + Agregar talla
            </button>
            <p className="mt-1 text-xs text-gray-400">
              El stock total es la suma de las tallas. Si el producto no tiene
              tallas, usa una sola «ÚNICA».
            </p>
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
              {loading ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
