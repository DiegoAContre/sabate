import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { CheckoutForm } from './checkout-form';

interface CartResponse {
  items: {
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
  }[];
}

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/checkout');
  }

  const { items } = await apiClient<CartResponse>('/api/cart', {
    token: session.accessToken,
  });

  if (items.length === 0) {
    redirect('/cart');
  }

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

      <div className="mb-4">
        <h2 className="mb-2 text-lg font-bold">Order summary</h2>
        {items.map((i) => (
          <div key={i.productId} className="flex justify-between border-b border-gray-200 py-2 text-sm">
            <span>
              {i.product.name} × {i.quantity}
            </span>
            <span>{formatPrice(i.product.price * i.quantity)}</span>
          </div>
        ))}
      </div>

      <CheckoutForm total={total} />
    </div>
  );
}
