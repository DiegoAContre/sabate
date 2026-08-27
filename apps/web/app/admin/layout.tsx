import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/admin/products" className="hover:underline">
            Products
          </Link>
          <Link href="/admin/categories" className="hover:underline">
            Categories
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
