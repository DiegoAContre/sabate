import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import type { Category, Product } from '@/lib/types';
import { ProductForm } from '../product-form';

export default async function EditProductPage(props: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/products');

  const { slug } = await props.params;

  const [{ product }, { data: categories }] = await Promise.all([
    apiClient<{ product: Product }>(`/api/products/${slug}`, { token: session.accessToken }),
    apiClient<{ data: Category[] }>('/api/categories', { token: session.accessToken }),
  ]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Edit product</h2>
      <ProductForm categories={categories} product={product} />
    </div>
  );
}
