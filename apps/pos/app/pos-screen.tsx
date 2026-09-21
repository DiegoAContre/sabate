'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product } from '@/db/client';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payment';
import { formatBs, formatRate, formatUsd } from '@/lib/format';
import type { CurrentRate } from '@/lib/rate';
import { Receipt, type ReceiptItem, type ReceiptSale } from './receipt';

interface Line {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const timeFmt = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' });

export function PosScreen({
  products,
  rate,
  isOwner,
  sellerName,
}: {
  products: Product[];
  rate: CurrentRate | null;
  isOwner: boolean;
  sellerName: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<{
    sale: ReceiptSale;
    items: ReceiptItem[];
  } | null>(null);

  const rateOk = rate?.isValid ?? false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q),
    );
  }, [products, query]);

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  function add(product: Product) {
    setError('');
    setLines((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (!found) {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            quantity: 1,
          },
        ];
      }
      return prev.map((l) =>
        l.productId === product.id
          ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) }
          : l,
      );
    });
  }

  function changeQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId
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
            quantity: l.quantity,
          })),
          paymentMethod: method,
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
        <div className="mb-6 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Venta registrada
        </div>
        <div className="rounded border border-gray-200 bg-white p-6">
          <Receipt sale={sale.sale} items={sale.items} sellerName={sellerName} />
        </div>
        <div className="no-print mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => setSale(null)}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Punto de venta</h1>
        {rate?.isValid && (
          <span className="text-sm text-gray-500">
            Tasa: {formatRate(rate.bsPerUsd)} Bs/$ (vence{' '}
            {timeFmt.format(rate.expiresAt)})
          </span>
        )}
      </div>

      {!rateOk && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {rate ? (
            <>
              La tasa del día venció a las {timeFmt.format(rate.expiresAt)}. No
              se puede vender.{' '}
            </>
          ) : (
            <>No hay tasa establecida. No se puede vender. </>
          )}
          {isOwner ? (
            <Link href="/tasa" className="font-medium underline">
              Actualizar tasa
            </Link>
          ) : (
            <>Avisa al propietario para actualizarla.</>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o SKU"
            className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={p.stock === 0}
                className="rounded border border-gray-200 p-3 text-left hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-sm">{formatUsd(p.price)}</p>
                <p
                  className={
                    p.stock === 0
                      ? 'text-xs font-semibold text-red-600'
                      : 'text-xs text-gray-500'
                  }
                >
                  {p.stock === 0 ? 'Sin stock' : `Stock: ${p.stock}`}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-gray-500">
                Sin resultados
              </p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80">
          <div className="rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-b border-gray-100">
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => changeQty(l.productId, -1)}
                          className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center">{l.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(l.productId, 1)}
                          className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatUsd(l.unitPrice * l.quantity)}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500">
                      Ticket vacío
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="border-t border-gray-200 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold">{formatUsd(total)}</span>
              </div>
              {rate && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total Bs</span>
                  <span>
                    {rateOk ? formatBs(total, rate.bsPerUsd) : 'tasa vencida'}
                  </span>
                </div>
              )}

              <label className="mt-3 block text-xs text-gray-600">
                Método de pago
                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value as PaymentMethod)
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m[0].toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={cobrar}
                disabled={lines.length === 0 || !rateOk || loading}
                className="mt-3 w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? '…' : 'Cobrar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
