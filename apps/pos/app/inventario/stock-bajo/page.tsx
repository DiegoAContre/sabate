import { and, asc, eq, lte } from 'drizzle-orm';
import { db, productSizes, products } from '@/db/client';
import { getCurrentRate } from '@/lib/rate';
import { formatBs, formatUsd } from '@/lib/format';

export default async function StockBajoPage() {
  const [low, allSizes, rate] = await Promise.all([
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          lte(products.stock, products.lowStockThreshold),
        ),
      )
      .orderBy(asc(products.stock)),
    db.select().from(productSizes).orderBy(productSizes.size),
    getCurrentRate(),
  ]);
  const sizesByProduct = new Map<string, { size: string; quantity: number }[]>();
  for (const s of allSizes) {
    const list = sizesByProduct.get(s.productId) ?? [];
    list.push({ size: s.size, quantity: s.quantity });
    sizesByProduct.set(s.productId, list);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Stock bajo</h1>
      <p className="mb-6 text-sm text-gray-600">
        Productos activos en o por debajo de su umbral de reposición.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2">Nombre</th>
              <th className="py-2">Código</th>
              <th className="py-2">Precio ($)</th>
              <th className="py-2">Precio (Bs)</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Tallas</th>
              <th className="py-2">Umbral</th>
            </tr>
          </thead>
          <tbody>
            {low.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2 font-medium">{p.name}</td>
                <td className="py-2 text-gray-600">{p.code ?? '—'}</td>
                <td className="py-2">{formatUsd(p.price)}</td>
                <td className="py-2">{rate ? formatBs(p.price, rate.bsPerUsd) : '—'}</td>
                <td className="py-2 font-semibold text-red-600">{p.stock}</td>
                <td className="py-2 text-gray-600">
                  {(sizesByProduct.get(p.id) ?? [])
                    .map((s) => `${s.size}:${s.quantity}`)
                    .join(' · ') || '—'}
                </td>
                <td className="py-2 text-gray-600">{p.lowStockThreshold}</td>
              </tr>
            ))}
            {low.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Todo el stock está por encima del umbral.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
