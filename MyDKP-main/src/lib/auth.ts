import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isAdmin: boolean;
  username?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'wow-dkp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getSession();
    return session.isAdmin === true;
  } catch (error) {
    console.error('Session check error:', error);
    return false;
  }
}