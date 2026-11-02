'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';

export interface NavLink {
  href: string;
  label: string;
}

export function NavDrawer({
  links,
  userBlock,
}: {
  links: NavLink[];
  userBlock: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        aria-label="Menú"
        onClick={() => ref.current?.showModal()}
        className="-ml-1 rounded-lg border border-slate-200 px-2 py-1 text-lg leading-none text-slate-600 hover:bg-slate-50 lg:hidden"
      >
        ☰
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="no-print m-0 h-full max-h-none w-72 max-w-[85vw] border-r border-slate-200 bg-white p-0 backdrop:bg-black/40 lg:hidden"
      >
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <img
              src="/logo.jpg"
              alt="Sabaté"
              className="h-9 w-9 rounded-md object-contain"
            />
            <p className="text-lg font-bold text-slate-900">
              Sabaté <span className="font-light text-brand">POS</span>
            </p>
          </div>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => ref.current?.close()}
                className={
                  pathname === l.href
                    ? 'rounded-md bg-brand-light px-3 py-2 text-sm font-medium text-brand'
                    : 'rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-slate-200 pt-4">{userBlock}</div>
        </div>
      </dialog>
    </>
  );
}
