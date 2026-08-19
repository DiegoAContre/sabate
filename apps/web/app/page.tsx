import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { Category, Paginated, Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { SearchBar } from './search-bar';

interface HomeProps {
  searchParams: Promise<{ search?: string; categoryId?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams;

  const params = new URLSearchParams();
  if (sp.search) params.set('search', sp.search);
  if (sp.categoryId) params.set('categoryId', sp.categoryId);
  const qs = params.toString();

  const [productsRes, categoriesRes] = await Promise.all([
    apiClient<Paginated<Product>>(`/api/products${qs ? `?${qs}` : ''}`),
    apiClient<{ data: Category[] }>('/api/categories'),
  ]);

  const products = productsRes.data;
  const categories = categoriesRes.data;

  return (
    <div>
      <SearchBar
        categories={categories}
        initialSearch={sp.search ?? ''}
        initialCategoryId={sp.categoryId ?? ''}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className="rounded border px-3 py-1 text-sm">
          All
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/?categoryId=${c.id}`} className="rounded border px-3 py-1 text-sm">
            {c.name}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-gray-500">No products found.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="group">
              <div className="aspect-square overflow-hidden rounded bg-gray-100">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <h2 className="mt-2 text-sm font-medium">{p.name}</h2>
              <p className="text-sm text-gray-700">{formatPrice(p.price)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
