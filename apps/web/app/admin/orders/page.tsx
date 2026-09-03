import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { AdminOrder } from '@/lib/types';
import { OrderStatusSelect } from './order-status-select';

export default async function AdminOrdersPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/orders');

  const { orders } = await apiClient<{ orders: AdminOrder[] }>('/api/admin/orders', {
    token: session.accessToken,
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Orders</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Items</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-100">
                <td className="py-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="py-2">
                  <div>{o.user.name}</div>
                  <div className="text-xs text-gray-500">{o.user.email}</div>
                </td>
                <td className="py-2">{o.items.length}</td>
                <td className="py-2">{formatPrice(o.total)}</td>
                <td className="py-2">
                  <OrderStatusSelect orderId={o.id} status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
