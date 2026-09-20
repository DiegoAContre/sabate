import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { Nav } from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sabate POS',
  description: 'Sistema local de inventario y ventas',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900">
        {session && <Nav session={session} />}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
