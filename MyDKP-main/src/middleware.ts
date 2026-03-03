import { NextRequest, NextResponse } from 'next/server';

const LEGACY_TEAM_PATH = /^\/team\/([a-zA-Z0-9_-]{1,48})$/;

export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(LEGACY_TEAM_PATH);
  if (!match) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${match[1]}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/team/:path*',
};
