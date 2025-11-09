import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin, getSession } from '@/lib/auth';

// PATCH /api/admins/[id] - 更新管理员权限（仅超管）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { teamIds, isActive, role } = await request.json();

    const updateData: any = {};

    // 更新激活状态
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // 更新角色
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'super_admin') {
        return NextResponse.json({ error: '无效的角色' }, { status: 400 });
      }
      updateData.role = role;
    }

    // 更新管理员基本信息
    if (Object.keys(updateData).length > 0) {
      await prisma.admin.update({
        where: { id: params.id },
        data: updateData,
      });
    }

    // 更新团队权限（仅针对普通管理员）
    if (teamIds !== undefined) {
      // 删除现有权限
      await prisma.teamPermission.deleteMany({
        where: { adminId: params.id },
      });

      // 创建新权限
      if (teamIds.length > 0) {
        await prisma.teamPermission.createMany({
          data: teamIds.map((teamId: string) => ({
            adminId: params.id,
            teamId,
          })),
        });
      }
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

    // 不能删除自己
    if (session.adminId === params.id) {
      return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
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