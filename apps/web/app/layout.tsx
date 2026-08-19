import type { Metadata } from 'next';
import { Providers } from './providers';
import { Nav } from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sabate',
  description: 'E-commerce platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
