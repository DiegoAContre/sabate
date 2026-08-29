import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Order } from '@/lib/types';

export default async function OrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/account/orders');
  }

  const { id } = await props.params;

  let order: Order;
  try {
    const res = await apiClient<{ order: Order }>(`/api/orders/${id}`, {
      token: session.accessToken,
    });
    order = res.order;
  } catch {
    notFound();
  }

  const address = order.shippingAddress;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/orders" className="mb-4 inline-block text-sm underline">
        &larr; Back to orders
      </Link>

      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order {order.id.slice(0, 8)}</h1>
        <span className="rounded bg-gray-100 px-3 py-1 text-sm capitalize">
          {order.status}
        </span>
      </div>
      <div className="mb-6 text-sm text-gray-500">
        Placed {new Date(order.createdAt).toLocaleDateString()}
      </div>

      <h2 className="mb-2 font-bold">Items</h2>
      <ul className="mb-6 divide-y divide-gray-200 rounded border border-gray-200">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{item.productName}</div>
              <div className="text-sm text-gray-500">Qty {item.quantity}</div>
            </div>
            <span className="font-medium">
              {formatPrice(item.unitPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{formatPrice(order.shipping)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      <h2 className="mb-2 mt-6 font-bold">Shipping address</h2>
      <div className="text-sm text-gray-600">
        {address.street}
        <br />
        {address.city}, {address.state} {address.zipCode}
        <br />
        {address.country}
      </div>
    </div>
  );
}
