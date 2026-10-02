import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

const PUBLIC_PATHS = ['/login', '/manifest.webmanifest', '/sw.js'];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith('/api/auth/login')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/icons')) return true;
  if (pathname.startsWith('/logo')) return true;
  if (/\.(png|jpg|jpeg|svg|ico|webmanifest|js|css|woff2?)$/i.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) {
    if (pathname === '/login' && req.cookies.get(SESSION_COOKIE)?.value) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
