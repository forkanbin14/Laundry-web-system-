
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * OWASP A01:2021 - Broken Access Control
 * Implements centralized access control at the edge.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const userRole = request.cookies.get('userRole')?.value;
  const { pathname } = request.nextUrl;

  // Define strict security headers
  const response = NextResponse.next();
  
  // OWASP Recommended Security Headers
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.google.com;");
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 1. Authentication Check
  if (!token && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Prevent Login page access if already authenticated
  if (token && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 3. Fine-grained RBAC Enforcement
  const adminRoutes = ['/settings', '/reports'];
  const privilegedRoutes = ['/invoicing', '/customers'];

  if (adminRoutes.some(route => pathname.startsWith(route)) && userRole !== 'Admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (privilegedRoutes.some(route => pathname.startsWith(route))) {
    const isPrivileged = ['Admin', 'Salesperson', 'Cashier', 'Special'].includes(userRole || '');
    if (!isPrivileged) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
