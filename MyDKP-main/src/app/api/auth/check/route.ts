import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({ 
      isAdmin: session.isAdmin === true,
      username: session.username || null,
      role: session.role || null,
      needPasswordChange: session.needPasswordChange || false,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ 
      isAdmin: false, 
      username: null, 
      role: null,
      needPasswordChange: false,
    });
  }
}