'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';

interface CartLineData {
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    stock: number;
  };
}

export function CartLine({ item }: { item: CartLineData }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function updateQty(newQty: number) {
    if (newQty <= 0) {
      await removeItem();
      return;
    }
    setLoading(true);
    try {
      await apiClient(`/api/cart/${item.productId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQty }),
        token: session?.accessToken,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function removeItem() {
    setLoading(true);
    try {
      await apiClient(`/api/cart/${item.productId}`, {
        method: 'DELETE',
        token: session?.accessToken,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const lineTotal = item.product.price * item.quantity;

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 py-4">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-gray-100">
        {item.product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.product.images[0]} alt={item.product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No img</div>
        )}
      </div>

      <div className="flex-1">
        <a href={`/products/${item.product.slug}`} className="font-medium hover:underline">
          {item.product.name}
        </a>
        <p className="text-sm text-gray-500">{formatPrice(item.product.price)}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => updateQty(item.quantity - 1)}
          disabled={loading}
          className="h-8 w-8 rounded border border-gray-300 disabled:opacity-50"
        >
          −
        </button>
        <span className="w-8 text-center text-sm">{item.quantity}</span>
        <button
          type="button"
          onClick={() => updateQty(item.quantity + 1)}
          disabled={loading || item.quantity >= item.product.stock}
          className="h-8 w-8 rounded border border-gray-300 disabled:opacity-50"
        >
          +
        </button>
      </div>

      <div className="w-24 text-right text-sm font-medium">{formatPrice(lineTotal)}</div>

      <button
        type="button"
        onClick={removeItem}
        disabled={loading}
        className="text-sm text-gray-400 hover:text-red-600 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
