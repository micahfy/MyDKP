import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 只有超级管理员可以调整团队顺序
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以调整团队顺序' },
        { status: 403 }
      );
    }

    const { teamIds } = await request.json();

    if (!Array.isArray(teamIds)) {
      return NextResponse.json(
        { error: '无效的团队ID列表' },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      teamIds.map((teamId, index) =>
        prisma.team.update({
          where: { id: teamId },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder teams error:', error);
    return NextResponse.json(
      { error: '更新排序失败' },
      { status: 500 }
    );
  }
}