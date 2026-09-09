'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { Category } from '@/lib/types';
import { Modal } from '../modal';

export function EditCategoryButton({
  category,
  categories,
}: {
  category: Category;
  categories: Category[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [parentId, setParentId] = useState(category.parentCategoryId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function openModal() {
    setName(category.name);
    setSlug(category.slug);
    setParentId(category.parentCategoryId ?? '');
    setError('');
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient(`/api/admin/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          slug,
          parentCategoryId: parentId || null,
        }),
        token: session?.accessToken,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
      >
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit category">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className={inputClass}
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug"
            required
            pattern="^[a-z0-9-]+$"
            className={inputClass}
          />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={inputClass}
          >
            <option value="">No parent</option>
            {categories
              .filter((c) => c.id !== category.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
