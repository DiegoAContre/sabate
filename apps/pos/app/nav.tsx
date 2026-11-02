'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Session } from '@/lib/auth';
import { NavDrawer, type NavLink } from './nav-drawer';
import { SignOutButton } from './sign-out';

function linksFor(session: Session): NavLink[] {
  return [
    { href: '/', label: 'Página de Venta' },
    { href: '/inventario', label: 'Inventario' },
    { href: '/inventario/stock-bajo', label: 'Stock bajo' },
    ...(session.role === 'owner'
      ? [
          { href: '/inventario/clasificacion', label: 'Categorías' },
          { href: '/ventas', label: 'Historial de ventas' },
          { href: '/usuarios', label: 'Usuarios' },
          { href: '/tasa', label: 'Tasa' },
        ]
      : []),
  ];
}

export function Nav({ session }: { session: Session }) {
  const links = linksFor(session);
  const pathname = usePathname();
  const roleLabel = session.role === 'owner' ? 'propietario' : 'vendedor';
  const userBlock = (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600">
        {session.name} ({roleLabel})
      </span>
      <SignOutButton />
    </div>
  );

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 lg:px-8">
        <NavDrawer links={links} userBlock={userBlock} />
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Sabaté"
            className="h-10 w-10 rounded-md object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Sabaté <span className="font-light text-brand">POS</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? 'rounded-md bg-brand-light px-3 py-2 text-sm font-medium text-brand'
                  : 'rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue'
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <div className="flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-700">
              {session.name}
            </span>
            <span className="text-xs text-brand-blue">({roleLabel})</span>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </span>
          <span className="h-6 w-px bg-slate-200" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
