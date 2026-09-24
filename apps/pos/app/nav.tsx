import Link from 'next/link';
import type { Session } from '@/lib/auth';
import { SignOutButton } from './sign-out';

export function Nav({ session }: { session: Session }) {
  return (
    <header className="no-print border-b border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          Sabate POS
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Punto de venta
          </Link>
          <Link
            href="/inventario/stock-bajo"
            className="text-gray-600 hover:text-gray-900"
          >
            Stock bajo
          </Link>
          {session.role === 'owner' && (
            <>
              <Link
                href="/inventario"
                className="text-gray-600 hover:text-gray-900"
              >
                Inventario
              </Link>
              <Link
                href="/inventario/clasificacion"
                className="text-gray-600 hover:text-gray-900"
              >
                Categorías
              </Link>
              <Link
                href="/ventas"
                className="text-gray-600 hover:text-gray-900"
              >
                Ventas
              </Link>
              <Link
                href="/usuarios"
                className="text-gray-600 hover:text-gray-900"
              >
                Usuarios
              </Link>
              <Link
                href="/tasa"
                className="text-gray-600 hover:text-gray-900"
              >
                Tasa
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {session.name} ({session.role === 'owner' ? 'propietario' : 'vendedor'})
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
