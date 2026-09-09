'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import type { OrderStatus } from '@/lib/types';
import { ConfirmDialog } from '../modal';

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
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!confirmStatus) return;
    setLoading(true);
    setError('');
    try {
      await apiClient(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify({ status: confirmStatus }),
      });
      setConfirmStatus(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <select
        value={confirmStatus ?? status}
        onChange={(e) => {
          const value = e.target.value as OrderStatus;
          if (value !== status) setConfirmStatus(value);
        }}
        className="rounded border border-gray-300 px-2 py-1 text-sm capitalize"
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmStatus !== null}
        onClose={() => setConfirmStatus(null)}
        title="Change order status"
        message={`Change status from "${status}" to "${confirmStatus}"?`}
        confirmLabel="Change status"
        loading={loading}
        error={error}
        onConfirm={handleConfirm}
      />
    </>
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
