import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({ isAdmin: session.isAdmin === true });
  } catch (error) {
    return NextResponse.json({ isAdmin: false });
  }
}