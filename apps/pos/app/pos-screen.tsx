'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product } from '@/db/schema';
import {
  PAYMENT_METHODS,
  REFERENCE_METHODS,
  paymentMethodLabel,
  type PaymentMethod,
} from '@/lib/payment';
import { formatBsCents, formatRate, formatUsd } from '@/lib/format';
import { taxBreakdown } from '@/lib/tax';
import type { CurrentRate } from '@/lib/rate';
import { Modal } from './modal';
import { Receipt, type ReceiptItem, type ReceiptSale } from './receipt';

interface Line {
  productId: string;
  size: string;
  name: string;
  brand: string;
  category: string;
  unitPrice: number;
  quantity: number;
}

const timeFmt = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' });

type CatalogProduct = Product & {
  category: string;
  brand: string;
  sizes: { size: string; quantity: number }[];
};

export function PosScreen({
  products,
  rate,
  isOwner,
}: {
  products: CatalogProduct[];
  rate: CurrentRate | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<CatalogProduct | null>(null);
  const [sale, setSale] = useState<{
    sale: ReceiptSale;
    items: ReceiptItem[];
  } | null>(null);

  const rateOk = rate?.isValid ?? false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.brand, p.category, p.code ?? ''].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [products, query]);

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const breakdown = rate ? taxBreakdown(total, rate.bsPerUsd) : null;
  const needsReference = REFERENCE_METHODS.includes(method);

  function availableFor(product: CatalogProduct, size: string) {
    return product.sizes.find((s) => s.size === size)?.quantity ?? 0;
  }

  function addDirect(product: CatalogProduct, size: string) {
    setError('');
    setLines((prev) => {
      const found = prev.find(
        (l) => l.productId === product.id && l.size === size,
      );
      const stock = availableFor(product, size);
      if (!found) {
        if (stock < 1) return prev;
        return [
          ...prev,
          {
            productId: product.id,
            size,
            name: product.name,
            brand: product.brand,
            category: product.category,
            unitPrice: product.price,
            quantity: 1,
          },
        ];
      }
      return prev.map((l) =>
        l.productId === product.id && l.size === size
          ? { ...l, quantity: Math.min(l.quantity + 1, stock) }
          : l,
      );
    });
  }

  function handleProduct(product: CatalogProduct) {
    if (product.sizes.length === 0) return;
    if (product.sizes.length === 1) {
      addDirect(product, product.sizes[0].size);
      return;
    }
    setPicker(product);
  }

  function changeQty(productId: string, size: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId && l.size === size
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  async function cobrar() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            size: l.size,
            quantity: l.quantity,
          })),
          paymentMethod: method,
          reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo registrar la venta');
        return;
      }
      setSale({ sale: data.sale, items: data.items });
      setLines([]);
      setQuery('');
      setReference('');
      router.refresh(); // fresh stock levels for the next sale
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  if (sale) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          Venta registrada
        </div>
        <div className="card p-6">
          <Receipt sale={sale.sale} items={sale.items} />
        </div>
        <div className="no-print mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary hover:bg-brand-dark"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => setSale(null)}
            className="btn-outline hover:bg-slate-50"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100vh-7rem)] lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-800">
            Página de Venta
          </h1>
          {rate?.isValid && (
            <span className="text-sm text-slate-500">
              Tasa: {formatRate(rate.bsPerUsd)} Bs/$ (vence{' '}
              {timeFmt.format(rate.expiresAt)})
            </span>
          )}
        </div>

        {!rateOk && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-r-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3 text-sm text-amber-800">
              <svg className="mt-0.5 h-5 w-5 shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <p>
                {rate ? (
                  <>
                    La tasa del día venció a las{' '}
                    {timeFmt.format(rate.expiresAt)}. No se puede vender.
                  </>
                ) : (
                  <>No hay tasa establecida. No se puede vender.</>
                )}
              </p>
            </div>
            {isOwner ? (
              <Link
                href="/tasa"
                className="whitespace-nowrap text-sm font-semibold text-amber-700 underline hover:text-amber-800"
              >
                Actualizar tasa
              </Link>
            ) : (
              <span className="whitespace-nowrap text-sm text-amber-700">
                Avisa al propietario
              </span>
            )}
          </div>
        )}

        <div className="relative mb-4">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 fill-slate-400"
            viewBox="0 0 24 24"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, código, marca o categoría..."
            className="w-full rounded-xl py-3 pl-11 pr-4 text-sm"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProduct(p)}
                disabled={p.stock === 0}
                className="flex h-40 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold leading-tight text-slate-800">
                    {p.name}
                  </p>
                  {(p.brand || p.category) && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {[p.brand, p.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-lg font-bold text-brand">
                    {formatUsd(p.price)}
                  </span>
                  <span
                    className={
                      p.stock === 0
                        ? 'rounded-md bg-red-50 px-2 py-1 text-[0.625rem] font-semibold text-red-600'
                        : 'rounded-md bg-slate-100 px-2 py-1 text-[0.625rem] font-medium text-slate-600'
                    }
                  >
                    {p.stock === 0
                      ? 'Sin stock'
                      : p.sizes.length > 1
                        ? `Stock: ${p.stock} · ${p.sizes
                            .filter((s) => s.quantity > 0)
                            .map((s) => s.size)
                            .join(' ')}`
                        : `Stock: ${p.stock}`}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">
                Sin resultados
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="card flex w-full flex-col overflow-hidden lg:max-h-full lg:w-[380px] lg:shrink-0">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-700">
            <svg className="h-5 w-5 fill-brand-blue" viewBox="0 0 24 24">
              <path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2L7.5 3.5 6 2 4.5 3.5 3 2v20z" />
            </svg>
            Ticket actual
          </h2>
          <span
            className={
              lines.length > 0
                ? 'rounded-full bg-brand-light px-2 py-1 text-xs font-medium text-brand'
                : 'rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600'
            }
          >
            {lines.length} {lines.length === 1 ? 'ítem' : 'ítems'}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <svg className="h-8 w-8 fill-slate-300" viewBox="0 0 24 24">
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </span>
              <p className="text-sm">Ticket vacío</p>
            </div>
          ) : (
            <ul>
              {lines.map((l) => (
                <li
                  key={`${l.productId}::${l.size}`}
                  className="flex items-center gap-2 border-b border-slate-100 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {l.name}
                    </p>
                    <p className="truncate text-[0.8125rem] text-slate-600">
                      {[...(l.brand ? [l.brand] : []), l.category]
                        .filter(Boolean)
                        .join(' · ')}
                      {(l.brand || l.category) && ' · '}
                      Talla {l.size}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Quitar uno"
                      onClick={() => changeQty(l.productId, l.size, -1)}
                      className="h-7 w-7 rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm">{l.quantity}</span>
                    <button
                      type="button"
                      aria-label="Agregar uno"
                      onClick={() => changeQty(l.productId, l.size, 1)}
                      className="h-7 w-7 rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-medium text-slate-700">
                    {formatUsd(l.unitPrice * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="no-print border-t border-slate-200 bg-slate-50 p-4">
          {breakdown && (
            <div className="space-y-1 border-b border-slate-200 pb-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Base imponible</span>
                <span className="font-medium text-slate-700">
                  {formatBsCents(breakdown.baseBsCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IVA (16%)</span>
                <span className="font-medium text-slate-700">
                  {formatBsCents(breakdown.ivaBsCents)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between pt-2">
            <span className="text-lg font-bold text-slate-800">Total</span>
            <span className="text-2xl font-bold text-brand">
              {formatUsd(total)}
            </span>
          </div>
          <div className="mb-4 mt-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Total Bs</span>
            {rateOk && breakdown ? (
              <span className="font-semibold text-slate-800">
                {formatBsCents(breakdown.totalBsCents)}
              </span>
            ) : (
              <span className="rounded border border-red-100 bg-red-50 px-2 py-0.5 font-medium text-red-500">
                tasa vencida
              </span>
            )}
          </div>

          <label className="block text-xs font-medium text-slate-500">
            Método de pago
            <div className="relative mt-1">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full appearance-none py-2.5 pl-3 pr-8 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel(m)}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-slate-500"
                viewBox="0 0 24 24"
              >
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </div>
          </label>

          {needsReference && (
            <label className="mt-3 block text-xs font-medium text-slate-500">
              N° de referencia (opcional)
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Referencia bancaria"
                className="mt-1 w-full px-3 py-2 text-sm"
              />
            </label>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={cobrar}
            disabled={lines.length === 0 || !rateOk || loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? '…' : 'Cobrar'}
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
            </svg>
          </button>
        </div>
      </aside>

      {picker && (
        <Modal
          open
          onClose={() => setPicker(null)}
          title={`Talla — ${picker.name}`}
        >
          <div className="flex flex-wrap gap-2">
            {picker.sizes.map((s) => (
              <button
                key={s.size}
                type="button"
                disabled={s.quantity === 0}
                onClick={() => {
                  addDirect(picker, s.size);
                  setPicker(null);
                }}
                className="min-w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:border-brand hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="font-medium">{s.size}</span>
                <span className="ml-1 text-xs text-slate-500">
                  {s.quantity === 0 ? 'agotada' : `(${s.quantity})`}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
