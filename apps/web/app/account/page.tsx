import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiClient } from '@/lib/api';
import { ProfileForm } from './profile-form';

interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
  };
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/account');
  }

  const { user } = await apiClient<MeResponse>('/api/auth/me', {
    token: session.accessToken,
  });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Account</h1>

      <ProfileForm user={user} token={session.accessToken} />

      <div className="mt-6 border-t border-gray-200 pt-4">
        <Link href="/account/orders" className="text-sm underline">
          View your orders
        </Link>
      </div>
    </div>
  );
}
