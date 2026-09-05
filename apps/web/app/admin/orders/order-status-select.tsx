'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { OrderStatus } from '@/lib/types';

const statusOptions: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: OrderStatus) {
    setLoading(true);
    try {
      await apiClient(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
      disabled={loading}
      className="rounded border border-gray-300 px-2 py-1 text-sm capitalize disabled:opacity-50"
    >
      {statusOptions.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function ResolveIssueButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function resolve() {
    setLoading(true);
    try {
      await apiClient(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify({ inventoryIssue: false }),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to resolve');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={resolve}
      disabled={loading}
      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? 'Resolving...' : 'Mark resolved'}
    </button>
  );
}
