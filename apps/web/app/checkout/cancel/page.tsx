import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-red-600">Payment cancelled</h1>
      <p className="mt-2 text-gray-600">Your payment was cancelled. Your cart is still intact.</p>
      <Link href="/cart" className="mt-6 inline-block text-sm underline">
        Back to cart
      </Link>
    </div>
  );
}
