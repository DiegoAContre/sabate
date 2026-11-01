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

type SortKey = 'nombre' | 'categoria' | 'marca' | 'estado';
type Dir = 'asc' | 'desc';

const SORT_KEYS: SortKey[] = ['nombre', 'categoria', 'marca', 'estado'];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : 'nombre';
  const dir: Dir = params.dir === 'desc' ? 'desc' : 'asc';

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

  const needle = q.toLowerCase();
  const rows = all
    .map((p) => ({
      product: p,
      categoryName: p.categoryId ? (categoryNames.get(p.categoryId) ?? '') : '',
      brandName: p.brandId ? (brandNames.get(p.brandId) ?? '') : '',
    }))
    .filter(
      (r) =>
        !needle ||
        r.product.name.toLowerCase().includes(needle) ||
        (r.product.code ?? '').toLowerCase().includes(needle) ||
        r.categoryName.toLowerCase().includes(needle) ||
        r.brandName.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const byName = a.product.name.localeCompare(b.product.name, 'es');
      let cmp = 0;
      if (sort === 'nombre') cmp = byName;
      else if (sort === 'categoria')
        cmp = a.categoryName.localeCompare(b.categoryName, 'es') || byName;
      else if (sort === 'marca')
        cmp = a.brandName.localeCompare(b.brandName, 'es') || byName;
      else cmp = Number(b.product.isActive) - Number(a.product.isActive) || byName;
      return dir === 'asc' ? cmp : -cmp;
    });

  const sortHref = (key: SortKey) => {
    const nextDir: Dir = sort === key && dir === 'asc' ? 'desc' : 'asc';
    const p = new URLSearchParams({ sort: key, dir: nextDir });
    if (q) p.set('q', q);
    return `/inventario?${p}`;
  };

  const header = (key: SortKey, label: string) => (
    <th className="py-2">
      <Link
        href={sortHref(key)}
        className={
          sort === key
            ? 'font-semibold text-gray-900 hover:underline'
            : 'hover:underline'
        }
      >
        {label}
        {sort === key && (
          <span className="ml-1 text-xs">{dir === 'asc' ? '▲' : '▼'}</span>
        )}
      </Link>
    </th>
  );

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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Buscar</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nombre, código, marca o categoría"
              className="w-72 rounded border border-gray-300 px-3 py-1.5"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700"
          >
            Buscar
          </button>
          {q && (
            <Link
              href={`/inventario?sort=${sort}&dir=${dir}`}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Limpiar
            </Link>
          )}
        </form>
        {q && (
          <p className="pb-2 text-sm text-gray-600">
            {rows.length} resultado{rows.length === 1 ? '' : 's'} para «{q}»
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              {header('nombre', 'Nombre')}
              <th className="py-2">Código</th>
              {header('categoria', 'Categoría')}
              {header('marca', 'Marca')}
              <th className="py-2">Precio ($)</th>
              <th className="py-2">Precio (Bs)</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Tallas</th>
              <th className="py-2">Umbral</th>
              {header('estado', 'Estado')}
              {isOwner && <th className="py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product: p, categoryName, brandName }) => {
              const sizes = sizesByProduct.get(p.id) ?? [];
              return (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-gray-600">{p.code ?? '—'}</td>
                  <td className="py-2 text-gray-600">{categoryName || '—'}</td>
                  <td className="py-2 text-gray-600">{brandName || '—'}</td>
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
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isOwner ? 11 : 10}
                  className="py-8 text-center text-gray-500"
                >
                  {q
                    ? `Sin resultados para «${q}».`
                    : isOwner
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
