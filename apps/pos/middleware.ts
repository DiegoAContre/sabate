import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/token';

// Sellers can sell and watch stock levels; everything else is owner-only.
const OWNER_ONLY = ['/inventario', '/ventas', '/usuarios', '/tasa'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/api/admin/backup'
  ) {
    // /api/auth y /api/admin/backup validan dentro del route (credenciales o
    // x-backup-token) — el middleware solo protege las demás rutas.
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (pathname === '/login') {
    return session
      ? NextResponse.redirect(new URL('/', req.url))
      : NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // /inventario/stock-bajo is seller-visible; everything else under these
  // prefixes (full inventory, any sale detail) is owner-only.
  const ownerOnly =
    OWNER_ONLY.includes(pathname) ||
    (pathname.startsWith('/inventario/') && pathname !== '/inventario/stock-bajo') ||
    pathname.startsWith('/ventas/');

  if (ownerOnly && session.role !== 'owner') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
