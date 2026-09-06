import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/lib/types';
import { DeleteProductButton } from './delete-button';

interface AdminProductsResponse {
  data: Product[];
}

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/products');

  const { data: products } = await apiClient<AdminProductsResponse>('/api/admin/products', {
    token: session.accessToken,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Products</h2>
        <Link
          href="/admin/products/new"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
        >
          New product
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Price</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">
                  <Link href={`/admin/products/${p.slug}`} className="hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="py-2">{formatPrice(p.price)}</td>
                <td className="py-2">{p.stock}</td>
                <td className="py-2">{p.isActive ? 'Active' : 'Inactive'}</td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/products/${p.slug}`}
                      className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={p.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
