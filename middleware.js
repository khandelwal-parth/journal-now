import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export function proxy(request) {
  const token = request.cookies.get('journal_token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isApi = pathname.startsWith('/api');

  const user = token ? verifyToken(token) : null;

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && !isAuthPage && !isApi) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};