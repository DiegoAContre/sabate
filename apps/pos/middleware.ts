import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/token';

// Sellers can sell and watch stock levels; everything else is owner-only.
const OWNER_ONLY = ['/inventario', '/ventas', '/usuarios'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/auth')) {
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

  // /inventario/stock-bajo is seller-visible; the full inventory page is not.
  const ownerOnly =
    OWNER_ONLY.includes(pathname) ||
    (pathname.startsWith('/inventario/') && pathname !== '/inventario/stock-bajo');

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
