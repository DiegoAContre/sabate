import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product } = await apiClient<{ product: Product }>(`/api/products/${slug}`);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded bg-gray-100">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No image</div>
        )}
      </div>
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          &larr; Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{product.name}</h1>
        <p className="mt-2 text-2xl">{formatPrice(product.price)}</p>
        {product.compareAtPrice ? (
          <p className="text-sm text-gray-500 line-through">{formatPrice(product.compareAtPrice)}</p>
        ) : null}
        {product.description ? <p className="mt-4 text-gray-700">{product.description}</p> : null}
        <p className="mt-4 text-sm text-gray-500">{product.stock} in stock</p>
      </div>
    </div>
  );
}
