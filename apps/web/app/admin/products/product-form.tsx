'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError, uploadImages } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Category } from '@/lib/types';

interface Product {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  categoryId: string | null;
  images: string[];
  isActive: boolean;
}

interface Props {
  categories: Category[];
  product?: Product;
}

export function ProductForm({ categories, product }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const isEdit = !!product?.id;

  const [form, setForm] = useState<Product>({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    price: product?.price ?? 0,
    compareAtPrice: product?.compareAtPrice ?? null,
    stock: product?.stock ?? 0,
    categoryId: product?.categoryId ?? null,
    images: product?.images ?? [],
    isActive: product?.isActive ?? true,
  });

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof Product>(field: K, value: Product[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let images = form.images;
      if (files.length > 0 && session?.accessToken) {
        const uploaded = await uploadImages(files, session.accessToken);
        images = [...images, ...uploaded];
      }

      const payload = { ...form, images };

      if (isEdit && product?.id) {
        await apiClient(`/api/admin/products/${product.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          token: session?.accessToken,
        });
      } else {
        await apiClient('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
          token: session?.accessToken,
        });
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save product');
      setLoading(false);
    }
  }

  function removeImage(url: string) {
    update('images', form.images.filter((i) => i !== url));
  }

  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <input
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Name"
        required
        className={inputClass}
      />
      <input
        value={form.slug}
        onChange={(e) => update('slug', e.target.value)}
        placeholder="Slug (lowercase, hyphens)"
        required
        pattern="^[a-z0-9-]+$"
        className={inputClass}
      />
      <textarea
        value={form.description ?? ''}
        onChange={(e) => update('description', e.target.value)}
        placeholder="Description"
        rows={4}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-4">
        <input
          type="number"
          value={form.price}
          onChange={(e) => update('price', Number(e.target.value))}
          placeholder="Price (cents)"
          required
          min={0}
          className={inputClass}
        />
        <input
          type="number"
          value={form.compareAtPrice ?? ''}
          onChange={(e) => update('compareAtPrice', e.target.value ? Number(e.target.value) : null)}
          placeholder="Compare-at price (cents)"
          min={0}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <input
          type="number"
          value={form.stock}
          onChange={(e) => update('stock', Number(e.target.value))}
          placeholder="Stock"
          required
          min={0}
          className={inputClass}
        />
        <select
          value={form.categoryId ?? ''}
          onChange={(e) => update('categoryId', e.target.value || null)}
          className={inputClass}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
        />
        Active
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Images</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {form.images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-20 rounded object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-600 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {files.length} file(s) will be uploaded on save
          </p>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-gray-900 px-6 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEdit ? 'Update product' : 'Create product'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="rounded border border-gray-300 px-6 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
