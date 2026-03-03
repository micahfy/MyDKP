import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultLoginTeamId } from '@/lib/systemSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const defaultLoginTeamId = await getDefaultLoginTeamId();
    if (!defaultLoginTeamId) {
      return NextResponse.json({ team: null });
    }

    const team = await prisma.team.findUnique({
      where: { id: defaultLoginTeamId },
      select: {
        id: true,
        serverName: true,
        guildName: true,
      },
    });

    return NextResponse.json({ team: team || null });
  } catch (error) {
    console.error('GET /api/entry/default-team error:', error);
    return NextResponse.json({ team: null });
  }
}
