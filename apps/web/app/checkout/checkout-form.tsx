'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';

export function CheckoutForm({ total }: { total: number }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Venezuela',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient<{ url: string }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ shippingAddress: form }),
        token: session?.accessToken,
      });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed');
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <h2 className="text-lg font-bold">Shipping address</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <input
        value={form.street}
        onChange={(e) => setForm({ ...form, street: e.target.value })}
        placeholder="Street address"
        required
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-4">
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
          required
          className={inputClass}
        />
        <input
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State"
          required
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          value={form.zipCode}
          onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
          placeholder="Zip code"
          required
          className={inputClass}
        />
        <input
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          placeholder="Country"
          required
          className={inputClass}
        />
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-lg font-bold">Total: {formatPrice(total)}</span>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-gray-900 px-8 py-3 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Pay with Stripe'}
        </button>
      </div>
    </form>
  );
}
