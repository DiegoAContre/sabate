import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, productSizes, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { getCurrentRate } from '@/lib/rate';
import { formatBs, formatRate, formatUsd } from '@/lib/format';
import { listTags } from '@/lib/tags';
import { NewProductButton } from './new-product-button';
import { EditButton } from './edit-button';
import { StockButton } from './stock-button';
import { DeactivateButton } from './deactivate-button';

export default async function InventarioPage() {
  const session = await getSession();
  const isOwner = session?.role === 'owner';
  const [all, allSizes, rate] = await Promise.all([
    db.select().from(products).orderBy(asc(products.name)),
    db.select().from(productSizes).orderBy(productSizes.size),
    getCurrentRate(),
  ]);
  const categories = listTags('category');
  const brands = listTags('brand');
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const brandNames = new Map(brands.map((b) => [b.id, b.name]));
  const sizesByProduct = new Map<string, { size: string; quantity: number }[]>();
  for (const s of allSizes) {
    const list = sizesByProduct.get(s.productId) ?? [];
    list.push({ size: s.size, quantity: s.quantity });
    sizesByProduct.set(s.productId, list);
  }

  const timeFmt = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Link
              href="/inventario/clasificacion"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Categorías y marcas
            </Link>
            <NewProductButton categories={categories} brands={brands} />
          </div>
        )}
      </div>

      {(!rate || !rate.isValid) && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {rate ? (
            <>
              La tasa del día venció a las {timeFmt.format(rate.expiresAt)}.{' '}
            </>
          ) : (
            <>No hay tasa establecida. </>
          )}
          {isOwner ? (
            <Link href="/tasa" className="font-medium underline">
              {rate ? 'Actualizar tasa' : 'Establecer tasa'}
            </Link>
          ) : (
            <>Avisa al propietario para actualizarla.</>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2">Nombre</th>
              <th className="py-2">Código</th>
              <th className="py-2">Categoría</th>
              <th className="py-2">Marca</th>
              <th className="py-2">Precio ($)</th>
              <th className="py-2">Precio (Bs)</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Tallas</th>
              <th className="py-2">Umbral</th>
              <th className="py-2">Estado</th>
              {isOwner && <th className="py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {all.map((p) => {
              const sizes = sizesByProduct.get(p.id) ?? [];
              return (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-gray-600">{p.code ?? '—'}</td>
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
                  <td className="py-2 text-gray-600">
                    {sizes.length === 0
                      ? '—'
                      : sizes
                          .map((s) => `${s.size}:${s.quantity}`)
                          .join(' · ')}
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
                  {isOwner && (
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <EditButton
                          product={p}
                          sizes={sizes}
                          categories={categories}
                          brands={brands}
                        />
                        <StockButton product={p} sizes={sizes} />
                        <DeactivateButton product={p} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr>
                <td
                  colSpan={isOwner ? 11 : 10}
                  className="py-8 text-center text-gray-500"
                >
                  {isOwner
                    ? 'No hay productos. Crea el primero con «Nuevo producto».'
                    : 'No hay productos.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rate?.isValid && (
        <p className="mt-4 text-xs text-gray-400">
          Tasa vigente: {formatRate(rate.bsPerUsd)} Bs/$ (vence a las{' '}
          {timeFmt.format(rate.expiresAt)})
        </p>
      )}
    </div>
  );
}
