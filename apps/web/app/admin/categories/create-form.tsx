'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { Category } from '@/lib/types';

export function CreateCategoryForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          slug,
          parentCategoryId: parentId || null,
        }),
        token: session?.accessToken,
      });
      setName('');
      setSlug('');
      setParentId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded border border-gray-200 p-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-3 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug"
          required
          pattern="^[a-z0-9-]+$"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">No parent</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create category'}
      </button>
    </form>
  );
}
