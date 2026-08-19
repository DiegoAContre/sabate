'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      const res = await signIn('credentials', { redirect: false, email, password });
      if (res?.error) {
        setError('Account created but sign-in failed. Please log in.');
        router.push('/login');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Create account</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        required
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 characters)"
        required
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Register'}
      </button>
      <p className="text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Login
        </Link>
      </p>
    </form>
  );
}
