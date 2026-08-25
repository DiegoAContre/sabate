'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';

export function AddToCartButton({ productId, stock }: { productId: string; stock: number }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [state, setState] = useState<'idle' | 'loading' | 'added' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleAdd() {
    if (status !== 'authenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/products/${productId}`)}`);
      return;
    }

    setState('loading');
    setMessage('');
    try {
      await apiClient('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 }),
        token: session?.accessToken,
      });
      setState('added');
      setMessage('Added to cart');
    } catch (err) {
      setState('error');
      setMessage(err instanceof ApiError ? err.message : 'Failed to add');
    }
  }

  const disabled = stock <= 0 || state === 'loading';

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="rounded bg-gray-900 px-6 py-2 text-sm text-white disabled:opacity-50"
      >
        {stock <= 0 ? 'Out of stock' : state === 'loading' ? 'Adding...' : 'Add to cart'}
      </button>
      {state === 'added' && <span className="text-sm text-green-600">{message}</span>}
      {state === 'error' && <span className="text-sm text-red-600">{message}</span>}
    </div>
  );
}
