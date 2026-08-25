import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-green-600">Payment confirmed</h1>
      <p className="mt-2 text-gray-600">Thank you for your order.</p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        Continue shopping
      </Link>
    </div>
  );
}
