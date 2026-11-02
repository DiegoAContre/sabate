import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { Nav } from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sabaté POS',
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
      <body className="min-h-screen bg-slate-50 text-slate-800">
        {session && <Nav session={session} />}
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
