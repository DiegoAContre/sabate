import Link from 'next/link';
import type { Session } from '@/lib/auth';
import { NavDrawer, type NavLink } from './nav-drawer';
import { SignOutButton } from './sign-out';

function linksFor(session: Session): NavLink[] {
  return [
    { href: '/', label: 'Punto de venta' },
    { href: '/inventario/stock-bajo', label: 'Stock bajo' },
    ...(session.role === 'owner'
      ? [
          { href: '/inventario', label: 'Inventario' },
          { href: '/inventario/clasificacion', label: 'Categorías' },
          { href: '/ventas', label: 'Ventas' },
          { href: '/usuarios', label: 'Usuarios' },
          { href: '/tasa', label: 'Tasa' },
        ]
      : []),
  ];
}

export function Nav({ session }: { session: Session }) {
  const links = linksFor(session);
  const roleLabel = session.role === 'owner' ? 'propietario' : 'vendedor';
  const userBlock = (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">
        {session.name} ({roleLabel})
      </span>
      <SignOutButton />
    </div>
  );

  return (
    <header className="no-print border-b border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <NavDrawer links={links} userBlock={userBlock} />
        <Link href="/" className="font-semibold">
          Sabate POS
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-gray-600 hover:text-gray-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden md:flex">{userBlock}</div>
      </div>
    </header>
  );
}
