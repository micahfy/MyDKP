import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isAdmin: boolean;
  username?: string;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: 'wow-dkp-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}