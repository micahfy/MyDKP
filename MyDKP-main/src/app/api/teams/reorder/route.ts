
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