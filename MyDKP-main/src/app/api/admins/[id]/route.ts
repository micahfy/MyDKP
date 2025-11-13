import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function ensureAnotherSuperAdmin(excludeId: string) {
  const count = await prisma.admin.count({
    where: {
      role: 'super_admin',
      isActive: true,
      NOT: { id: excludeId },
    },
  });
  return count > 0;
}

// PATCH /api/admins/[id] - 更新管理员权限（仅超管）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const { teamIds, isActive, role } = await request.json();

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: '管理员不存在' }, { status: 404 });
    }

    if (targetAdmin.isProtected && session.adminId !== params.id) {
      return NextResponse.json(
        { error: '该管理员账号受保护，无法被其他人修改', isProtected: true },
        { status: 403 }
      );
    }

    if (role !== undefined && session.adminId === params.id) {
      return NextResponse.json(
        { error: '不能修改自己的角色' },
        { status: 400 }
      );
    }

    if (role && role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 });
    }

    if (targetAdmin.role === 'super_admin') {
      const nextRole = role ?? targetAdmin.role;
      const nextActive =
        typeof isActive === 'boolean' ? isActive : targetAdmin.isActive;
      const willLoseSuperRole = nextRole !== 'super_admin';
      const willDeactivate = nextActive === false;

      if ((willLoseSuperRole || willDeactivate) && !(await ensureAnotherSuperAdmin(params.id))) {
        return NextResponse.json(
          { error: '系统至少需要一位活跃的超级管理员' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    let shouldIncrementVersion = false;

    if (typeof isActive === 'boolean' && isActive !== targetAdmin.isActive) {
      updateData.isActive = isActive;
      shouldIncrementVersion = true;
    }

    if (role && role !== targetAdmin.role) {
      updateData.role = role;
      shouldIncrementVersion = true;
    }

    if (shouldIncrementVersion) {
      updateData.permissionVersion = { increment: 1 };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.admin.update({
        where: { id: params.id },
        data: updateData,
      });
    }

    if (teamIds !== undefined) {
      if (!Array.isArray(teamIds)) {
        return NextResponse.json({ error: 'teamIds 必须是数组' }, { status: 400 });
      }

      await prisma.teamPermission.deleteMany({
        where: { adminId: params.id },
      });

      if (teamIds.length > 0) {
        await prisma.teamPermission.createMany({
          data: teamIds.map((teamId: string) => ({
            adminId: params.id,
            teamId,
          })),
        });
      }

      await prisma.admin.update({
        where: { id: params.id },
        data: {
          permissionVersion: {
            increment: 1,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update admin error:', error);
    return NextResponse.json({ error: '更新管理员失败' }, { status: 500 });
  }
}

// DELETE /api/admins/[id] - 删除管理员（仅超管）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();

    if (session.adminId === params.id) {
      return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
    }

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: '管理员不存在' }, { status: 404 });
    }

    if (targetAdmin.isProtected) {
      return NextResponse.json(
        { error: '该管理员账号受保护，无法删除', isProtected: true },
        { status: 403 }
      );
    }

    if (targetAdmin.role === 'super_admin' && !(await ensureAnotherSuperAdmin(params.id))) {
      return NextResponse.json(
        { error: '系统至少需要一位活跃的超级管理员' },
        { status: 400 }
      );
    }

    await prisma.admin.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json({ error: '删除管理员失败' }, { status: 500 });
  }
}
