import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link
        href="/admin/products"
        className="rounded border border-gray-200 p-6 hover:bg-gray-50"
      >
        <h2 className="text-lg font-bold">Products</h2>
        <p className="text-sm text-gray-600">Create, edit, and delete products.</p>
      </Link>
      <Link
        href="/admin/categories"
        className="rounded border border-gray-200 p-6 hover:bg-gray-50"
      >
        <h2 className="text-lg font-bold">Categories</h2>
        <p className="text-sm text-gray-600">Create and delete categories.</p>
      </Link>
      <Link
        href="/admin/users"
        className="rounded border border-gray-200 p-6 hover:bg-gray-50"
      >
        <h2 className="text-lg font-bold">Users</h2>
        <p className="text-sm text-gray-600">Manage roles and account status.</p>
      </Link>
      <Link
        href="/admin/orders"
        className="rounded border border-gray-200 p-6 hover:bg-gray-50"
      >
        <h2 className="text-lg font-bold">Orders</h2>
        <p className="text-sm text-gray-600">View and update order statuses.</p>
      </Link>
    </div>
  );
}
