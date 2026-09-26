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
        className="-ml-1 rounded border border-gray-300 px-2 py-1 text-lg leading-none text-gray-700 hover:bg-gray-100 md:hidden"
      >
        ☰
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="no-print m-0 h-full max-h-none w-72 max-w-[85vw] border-r border-gray-200 bg-white p-0 backdrop:bg-black/40 md:hidden"
      >
        <div className="p-4">
          <p className="mb-3 font-semibold">Sabate POS</p>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => ref.current?.close()}
                className={
                  pathname === l.href
                    ? 'rounded bg-gray-100 px-3 py-2 text-sm font-medium'
                    : 'rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50'
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-gray-200 pt-4">{userBlock}</div>
        </div>
      </dialog>
    </>
  );
}
