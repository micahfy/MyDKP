import { NextRequest, NextResponse } from 'next/server';

const RESERVED_PREFIXES = [
  '/api',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/public',
  '/assets',
  '/team',
];

const RESERVED_PATHS = new Set([
  '/',
  '/reset-password',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip known framework/app routes
  if (RESERVED_PATHS.has(pathname) || RESERVED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rewrite single-segment slug to /team/[slug]
  const match = pathname.match(/^\/([a-zA-Z0-9_-]{1,32})$/);
  if (!match) {
    return NextResponse.next();
  }

  const slug = match[1];
  const url = request.nextUrl.clone();
  url.pathname = `/team/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: '/:path*',
};
