import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, products } from '@/db/client';
import { getCurrentRate } from '@/lib/rate';
import { formatBs, formatRate, formatUsd } from '@/lib/format';
import { listTags } from '@/lib/tags';
import { NewProductButton } from './new-product-button';
import { EditButton } from './edit-button';
import { StockButton } from './stock-button';
import { DeactivateButton } from './deactivate-button';

export default async function InventarioPage() {
  const [all, rate] = await Promise.all([
    db.select().from(products).orderBy(asc(products.name)),
    getCurrentRate(),
  ]);
  const categories = listTags('category');
  const brands = listTags('brand');
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const brandNames = new Map(brands.map((b) => [b.id, b.name]));

  const timeFmt = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/inventario/clasificacion"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Categorías y marcas
          </Link>
          <NewProductButton categories={categories} brands={brands} />
        </div>
      </div>

      {(!rate || !rate.isValid) && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {rate ? (
            <>
              La tasa del día venció a las {timeFmt.format(rate.expiresAt)}.{' '}
              <Link href="/tasa" className="font-medium underline">
                Actualizar tasa
              </Link>
            </>
          ) : (
            <>
              No hay tasa establecida.{' '}
              <Link href="/tasa" className="font-medium underline">
                Establecer tasa
              </Link>
            </>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Nombre</th>
            <th className="py-2">Categoría</th>
            <th className="py-2">Marca</th>
            <th className="py-2">Precio ($)</th>
            <th className="py-2">Precio (Bs)</th>
            <th className="py-2">Stock</th>
            <th className="py-2">Umbral</th>
            <th className="py-2">Estado</th>
            <th className="py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {all.map((p) => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="py-2 font-medium">{p.name}</td>
              <td className="py-2 text-gray-600">
                {p.categoryId ? (categoryNames.get(p.categoryId) ?? '—') : '—'}
              </td>
              <td className="py-2 text-gray-600">
                {p.brandId ? (brandNames.get(p.brandId) ?? '—') : '—'}
              </td>
              <td className="py-2">{formatUsd(p.price)}</td>
              <td className="py-2">
                {rate ? formatBs(p.price, rate.bsPerUsd) : '—'}
              </td>
              <td
                className={
                  p.stock <= p.lowStockThreshold
                    ? 'py-2 font-semibold text-red-600'
                    : 'py-2'
                }
              >
                {p.stock}
              </td>
              <td className="py-2 text-gray-600">{p.lowStockThreshold}</td>
              <td className="py-2">
                {p.isActive ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    activo
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    inactivo
                  </span>
                )}
              </td>
              <td className="py-2">
                <div className="flex justify-end gap-2">
                  <EditButton
                    product={p}
                    categories={categories}
                    brands={brands}
                  />
                  <StockButton product={p} />
                  <DeactivateButton product={p} />
                </div>
              </td>
            </tr>
          ))}
          {all.length === 0 && (
            <tr>
              <td colSpan={9} className="py-8 text-center text-gray-500">
                No hay productos. Crea el primero con «Nuevo producto».
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {rate?.isValid && (
        <p className="mt-4 text-xs text-gray-400">
          Tasa vigente: {formatRate(rate.bsPerUsd)} Bs/$ (vence a las{' '}
          {timeFmt.format(rate.expiresAt)})
        </p>
      )}
    </div>
  );
}
