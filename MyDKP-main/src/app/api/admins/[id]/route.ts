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

    const session = await getSession();
    const { teamIds, isActive, role } = await request.json();

    // 检查目标管理员是否存在
    const targetAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: '管理员不存在' }, { status: 404 });
    }

    // 检查目标管理员是否受保护
    if (targetAdmin.isProtected) {
      // 只有受保护的管理员自己可以修改自己
      if (session.adminId !== params.id) {
        return NextResponse.json({ 
          error: '该管理员账号受保护，无法被其他管理员修改',
          isProtected: true 
        }, { status: 403 });
      }
    }

    // 不能修改自己的角色（防止误操作导致自己失去权限）
    if (role !== undefined && session.adminId === params.id) {
      return NextResponse.json({ 
        error: '不能修改自己的角色' 
      }, { status: 400 });
    }

    const updateData: any = {};
    let needIncrementVersion = false;

    // 更新激活状态
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      needIncrementVersion = true;
    }

    // 更新角色
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'super_admin') {
        return NextResponse.json({ error: '无效的角色' }, { status: 400 });
      }
      updateData.role = role;
      needIncrementVersion = true;
    }

    // 递增权限版本号
    if (needIncrementVersion) {
      updateData.permissionVersion = {
        increment: 1,
      };
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

      // 团队权限变更也需要递增版本号
      if (!needIncrementVersion) {
        await prisma.admin.update({
          where: { id: params.id },
          data: {
            permissionVersion: {
              increment: 1,
            },
          },
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

    // 检查目标管理员是否受保护
    const targetAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (targetAdmin?.isProtected) {
      return NextResponse.json({ 
        error: '该管理员账号受保护，无法删除',
        isProtected: true 
      }, { status: 403 });
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