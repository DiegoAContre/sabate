'use client';

import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
    >
      Cerrar sesión
    </button>
  );
}
