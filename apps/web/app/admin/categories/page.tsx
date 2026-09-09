import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import type { Category } from '@/lib/types';
import { CreateCategoryForm } from './create-form';
import { EditCategoryButton } from './edit-button';
import { DeleteCategoryButton } from './delete-button';

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/categories');

  const { data: categories } = await apiClient<{ data: Category[] }>('/api/categories', {
    token: session.accessToken,
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Categories</h2>
      <CreateCategoryForm categories={categories} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Parent</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2">{c.name}</td>
                <td className="py-2">{c.slug}</td>
                <td className="py-2">
                  {categories.find((p) => p.id === c.parentCategoryId)?.name ?? '—'}
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <EditCategoryButton category={c} categories={categories} />
                    <DeleteCategoryButton id={c.id} name={c.name} />
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
