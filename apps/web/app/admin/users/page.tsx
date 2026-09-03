import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import type { User } from '@/lib/types';
import { UserActions } from './user-actions';

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/admin/users');

  const { users } = await apiClient<{ users: User[] }>('/api/admin/users', {
    token: session.accessToken,
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Users</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left">
            <tr>
              <th className="py-2">Email</th>
              <th className="py-2">Name</th>
              <th className="py-2">Role</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.isActive ? 'Active' : 'Inactive'}</td>
                <td className="py-2 text-right">
                  <UserActions user={u} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
