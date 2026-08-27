import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import type { Category } from '@/lib/types';
import { ProductForm } from '../product-form';

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/products/new');

  const { data: categories } = await apiClient<{ data: Category[] }>('/api/categories', {
    token: session.accessToken,
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">New product</h2>
      <ProductForm categories={categories} />
    </div>
  );
}
