import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/account/orders');
  }

  const { orders } = await apiClient<{ orders: Order[] }>('/api/orders', {
    token: session.accessToken,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Your orders</h1>

      {orders.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>You have no orders yet.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${statusStyles[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>
                <span className="font-bold">{formatPrice(order.total)}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {order.items.length} item{order.items.length === 1 ? '' : 's'}
              </div>
              <Link
                href={`/account/orders/${order.id}`}
                className="mt-2 inline-block text-sm underline"
              >
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
