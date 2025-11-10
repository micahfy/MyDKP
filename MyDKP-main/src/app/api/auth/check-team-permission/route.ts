import { NextRequest, NextResponse } from 'next/server';
import { hasTeamPermission, isAdmin } from '@/lib/auth';
// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ hasPermission: false });
    }

    const adminStatus = await isAdmin();
    if (!adminStatus) {
      return NextResponse.json({ hasPermission: false });
    }

    const hasPermission = await hasTeamPermission(teamId);
    return NextResponse.json({ hasPermission });
  } catch (error) {
    console.error('Check team permission error:', error);
    return NextResponse.json({ hasPermission: false });
  }
}