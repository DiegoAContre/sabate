import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { CartLine } from './cart-line';

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

export default async function CartPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/cart');
  }

  const { items } = await apiClient<CartResponse>('/api/cart', {
    token: session.accessToken,
  });

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Cart</h1>

      {items.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>Your cart is empty.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Browse products
          </Link>
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <CartLine key={item.productId} item={item} />
          ))}

          <div className="mt-6 flex items-center justify-between">
            <span className="text-lg font-bold">Total</span>
            <span className="text-lg font-bold">{formatPrice(total)}</span>
          </div>

          <Link
            href="/checkout"
            className="mt-6 block w-full rounded bg-gray-900 px-6 py-3 text-center text-sm text-white"
          >
            Checkout
          </Link>
        </div>
      )}
    </div>
  );
}
