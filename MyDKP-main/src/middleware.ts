import { NextRequest, NextResponse } from 'next/server';

const RESERVED_PREFIXES = [
  '/api',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/public',
  '/assets',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 已知前缀直接放行
  if (pathname === '/' || RESERVED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 只接受简单短链（单层路径，无子路径）
  const match = pathname.match(/^\/([a-zA-Z0-9_-]{1,32})$/);
  if (!match) {
    return NextResponse.next();
  }

  const slug = match[1];
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('teamSlug', slug);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: '/:path*',
};
