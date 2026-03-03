import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { renderEmailTemplate } from '@/lib/emailTemplates';

const RESET_TOKEN_TTL_MINUTES_DEFAULT = 30;

function getResetTokenTtlMinutes() {
  const value = Number(process.env.ADMIN_PASSWORD_RESET_TOKEN_TTL_MINUTES || RESET_TOKEN_TTL_MINUTES_DEFAULT);
  if (!Number.isFinite(value) || value <= 0) return RESET_TOKEN_TTL_MINUTES_DEFAULT;
  return Math.floor(value);
}

function getAppBaseUrl() {
  const fromEnv = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).trim();
  return fromEnv.replace(/\/+$/, '');
}

function hashResetToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function requestAdminPasswordReset(identifier: string) {
  const normalized = (identifier || '').trim();
  if (!normalized) {
    return { sent: false };
  }

  const admin = await prisma.admin.findFirst({
    where: {
      isActive: true,
      OR: [{ username: normalized }, { email: normalized.toLowerCase() }],
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });

  if (!admin || !admin.email) {
    return { sent: false };
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const ttlMinutes = getResetTokenTtlMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      adminId: admin.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetLink = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const requestTime = new Date().toISOString();
  const rendered = await renderEmailTemplate(
    'admin_password_reset',
    {
      username: admin.username,
      resetLink,
      expiresMinutes: ttlMinutes,
      requestTime,
    },
    {
      subject: `[MyDKP] 重置密码 - ${admin.username}`,
      bodyText: [
        `你好 ${admin.username}，`,
        '',
        `请在 ${ttlMinutes} 分钟内点击下方链接重置密码：`,
        resetLink,
        '',
        '如果这不是你本人操作，请忽略本邮件。',
      ].join('\n'),
    },
  );

  await sendMail({
    to: [admin.email],
    subject: rendered.subject,
    text: rendered.bodyText,
  });

  return { sent: true };
}

export async function resetAdminPasswordWithToken(rawToken: string, newPasswordHash: string) {
  const token = (rawToken || '').trim();
  if (!token) {
    throw new Error('重置令牌不能为空');
  }

  const now = new Date();
  const tokenHash = hashResetToken(token);

  const existing = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    include: {
      admin: {
        select: { id: true, username: true, isActive: true },
      },
    },
  });

  if (!existing || !existing.admin.isActive) {
    throw new Error('重置链接无效或已过期');
  }

  await prisma.$transaction(async (tx) => {
    await tx.admin.update({
      where: { id: existing.admin.id },
      data: {
        password: newPasswordHash,
        needPasswordChange: false,
      },
    });

    await tx.passwordResetToken.update({
      where: { id: existing.id },
      data: { usedAt: now },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        adminId: existing.admin.id,
        usedAt: null,
        NOT: { id: existing.id },
      },
      data: { usedAt: now },
    });
  });

  return { adminId: existing.admin.id, username: existing.admin.username };
}
