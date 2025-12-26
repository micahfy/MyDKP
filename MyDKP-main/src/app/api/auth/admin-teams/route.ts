import { NextResponse } from 'next/server';
import { getAdminTeams, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const teamIds = await getAdminTeams();
  return NextResponse.json({ teamIds });
}
