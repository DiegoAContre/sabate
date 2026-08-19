'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Category } from '@/lib/types';

interface Props {
  categories: Category[];
  initialSearch: string;
  initialCategoryId: string;
}

export function SearchBar({ categories, initialSearch, initialCategoryId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (categoryId) params.set('categoryId', categoryId);
    router.push(`/${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Search
      </button>
    </form>
  );
}
