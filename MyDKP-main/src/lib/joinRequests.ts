import { createHash, randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePassword } from '@/lib/password';
import { renderEmailTemplate } from '@/lib/emailTemplates';
import { sendMail } from '@/lib/mailer';
import { generateUniqueTeamSlug } from '@/lib/teamSlug';
import { getJoinRequestNotifyEmail } from '@/lib/systemSettings';

const VERIFICATION_PURPOSE = 'join_request';
const CODE_TTL_MINUTES_DEFAULT = 10;
const CODE_SEND_INTERVAL_SECONDS_DEFAULT = 60;
const CODE_MAX_ATTEMPTS_DEFAULT = 5;

function normalizeEmail(input: unknown) {
  return String(input || '').trim().toLowerCase();
}

function normalizeText(input: unknown) {
  return String(input || '').trim();
}

function getCodeTtlMinutes() {
  const value = Number(process.env.JOIN_REQUEST_CODE_TTL_MINUTES || CODE_TTL_MINUTES_DEFAULT);
  if (!Number.isFinite(value) || value <= 0) return CODE_TTL_MINUTES_DEFAULT;
  return Math.floor(value);
}

function getCodeSendIntervalSeconds() {
  const value = Number(
    process.env.JOIN_REQUEST_CODE_MIN_INTERVAL_SECONDS || CODE_SEND_INTERVAL_SECONDS_DEFAULT,
  );
  if (!Number.isFinite(value) || value < 0) return CODE_SEND_INTERVAL_SECONDS_DEFAULT;
  return Math.floor(value);
}

function getCodeMaxAttempts() {
  const value = Number(process.env.JOIN_REQUEST_CODE_MAX_ATTEMPTS || CODE_MAX_ATTEMPTS_DEFAULT);
  if (!Number.isFinite(value) || value <= 0) return CODE_MAX_ATTEMPTS_DEFAULT;
  return Math.floor(value);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashCode(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function createVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function sendJoinRequestVerificationCode(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!email || !isValidEmail(email)) {
    throw new Error('请输入有效邮箱地址');
  }

  const minIntervalSeconds = getCodeSendIntervalSeconds();
  if (minIntervalSeconds > 0) {
    const latest = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        purpose: VERIFICATION_PURPOSE,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latest) {
      const minIntervalMs = minIntervalSeconds * 1000;
      const elapsedMs = Date.now() - latest.createdAt.getTime();
      if (elapsedMs < minIntervalMs) {
        return {
          sent: false,
          throttled: true,
          retryAfterSeconds: Math.ceil((minIntervalMs - elapsedMs) / 1000),
        };
      }
    }
  }

  const code = createVerificationCode();
  const codeHash = hashCode(code);
  const ttlMinutes = getCodeTtlMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  let createdCodeId: string | null = null;
  try {
    const created = await prisma.emailVerificationCode.create({
      data: {
        email,
        purpose: VERIFICATION_PURPOSE,
        codeHash,
        expiresAt,
      },
      select: { id: true },
    });
    createdCodeId = created.id;

    const rendered = await renderEmailTemplate(
      'join_request_verification_code',
      {
        email,
        code,
        expiresMinutes: ttlMinutes,
        requestTime: new Date().toISOString(),
      },
      {
        subject: '[MyDKP] 加入申请邮箱验证码',
        bodyText: [
          `邮箱：${email}`,
          `验证码：${code}`,
          `有效期：${ttlMinutes} 分钟`,
          '如果不是你本人操作，请忽略这封邮件。',
        ].join('\n'),
      },
    );

    await sendMail({
      to: [email],
      subject: rendered.subject,
      text: rendered.bodyText,
    });
  } catch (error) {
    if (createdCodeId) {
      await prisma.emailVerificationCode.delete({ where: { id: createdCodeId } }).catch(() => null);
    }
    throw error;
  }

  return { sent: true, throttled: false };
}

async function verifyJoinRequestCode(emailInput: string, verificationCode: string) {
  const email = normalizeEmail(emailInput);
  const code = normalizeText(verificationCode);
  const now = new Date();

  if (!email || !code) {
    throw new Error('邮箱验证码不能为空');
  }

  const latest = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      purpose: VERIFICATION_PURPOSE,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) {
    throw new Error('验证码无效或已过期');
  }

  const maxAttempts = getCodeMaxAttempts();
  if (latest.attemptCount >= maxAttempts) {
    throw new Error('验证码尝试次数过多，请重新获取');
  }

  if (latest.codeHash !== hashCode(code)) {
    await prisma.emailVerificationCode.update({
      where: { id: latest.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new Error('验证码错误');
  }

  await prisma.emailVerificationCode.update({
    where: { id: latest.id },
    data: { usedAt: now },
  });
}

export type CreateJoinRequestInput = {
  serverName: string;
  guildName: string;
  teamName: string;
  requestedUsername: string;
  password: string;
  email: string;
  verificationCode: string;
};

export async function createJoinRequest(input: CreateJoinRequestInput) {
  const serverName = normalizeText(input.serverName);
  const guildName = normalizeText(input.guildName);
  const teamName = normalizeText(input.teamName);
  const requestedUsername = normalizeText(input.requestedUsername);
  const password = String(input.password || '');
  const email = normalizeEmail(input.email);
  const verificationCode = normalizeText(input.verificationCode);

  if (!serverName || !guildName || !teamName || !requestedUsername || !password || !email || !verificationCode) {
    throw new Error('请完整填写申请信息');
  }

  if (!isValidEmail(email)) {
    throw new Error('邮箱格式不正确');
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors[0] || '密码不符合要求');
  }

  await verifyJoinRequestCode(email, verificationCode);

  const [existingAdminByUsername, existingAdminByEmail, existingTeam, pendingRequest] = await Promise.all([
    prisma.admin.findUnique({ where: { username: requestedUsername }, select: { id: true } }),
    prisma.admin.findUnique({ where: { email }, select: { id: true } }),
    prisma.team.findUnique({
      where: {
        serverName_guildName_name: {
          serverName,
          guildName,
          name: teamName,
        },
      },
      select: { id: true },
    }),
    prisma.joinRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { requestedUsername },
          { email },
          {
            serverName,
            guildName,
            teamName,
          },
        ],
      },
      select: { id: true },
    }),
  ]);

  if (existingAdminByUsername) {
    throw new Error('该操作员账号已存在');
  }
  if (existingAdminByEmail) {
    throw new Error('该邮箱已绑定管理员账号');
  }
  if (existingTeam) {
    throw new Error('该服务器/工会/团队已存在');
  }
  if (pendingRequest) {
    throw new Error('存在待审批的重复申请，请等待处理');
  }

  const passwordHash = await hashPassword(password);

  const request = await prisma.joinRequest.create({
    data: {
      serverName,
      guildName,
      teamName,
      requestedUsername,
      passwordHash,
      email,
      status: 'pending',
    },
  });

  const notifyEmail = await getJoinRequestNotifyEmail();
  if (notifyEmail) {
    try {
      const rendered = await renderEmailTemplate(
        'join_request_submitted_notify_admin',
        {
          requestId: request.id,
          serverName,
          guildName,
          teamName,
          requestedUsername,
          email,
          createdAt: request.createdAt.toISOString(),
        },
        {
          subject: '[MyDKP] 新的入驻申请待审批',
          bodyText: [
            `申请ID: ${request.id}`,
            `服务器: ${serverName}`,
            `工会: ${guildName}`,
            `团队: ${teamName}`,
            `操作员: ${requestedUsername}`,
            `邮箱: ${email}`,
            '请登录后台进行审批。',
          ].join('\n'),
        },
      );

      await sendMail({
        to: [notifyEmail],
        subject: rendered.subject,
        text: rendered.bodyText,
      });
    } catch (error) {
      console.error('join request notify admin mail failed:', error);
    }
  }

  return request;
}

export async function listJoinRequests(status?: string) {
  const normalizedStatus = normalizeText(status);
  return prisma.joinRequest.findMany({
    where: normalizedStatus
      ? {
          status: normalizedStatus,
        }
      : undefined,
    include: {
      reviewedByAdmin: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function reviewJoinRequest(
  requestId: string,
  action: 'approve' | 'reject',
  reviewerAdminId: string,
  approvalNote?: string,
) {
  const id = normalizeText(requestId);
  if (!id) {
    throw new Error('申请ID不能为空');
  }

  const request = await prisma.joinRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new Error('申请不存在');
  }
  if (request.status !== 'pending') {
    throw new Error('该申请已处理');
  }

  if (action === 'reject') {
    const reviewed = await prisma.joinRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvalNote: normalizeText(approvalNote) || null,
        reviewedByAdminId: reviewerAdminId,
        reviewedAt: new Date(),
      },
    });

    try {
      const rendered = await renderEmailTemplate(
        'join_request_rejected_notify_applicant',
        {
          requestId: reviewed.id,
          serverName: reviewed.serverName,
          guildName: reviewed.guildName,
          teamName: reviewed.teamName,
          requestedUsername: reviewed.requestedUsername,
          email: reviewed.email,
          approvalNote: reviewed.approvalNote || '',
          reviewedAt: reviewed.reviewedAt?.toISOString() || '',
        },
        {
          subject: '[MyDKP] 入驻申请未通过',
          bodyText: [
            `申请ID: ${reviewed.id}`,
            `团队: ${reviewed.serverName} / ${reviewed.guildName} / ${reviewed.teamName}`,
            `操作员: ${reviewed.requestedUsername}`,
            `结果: 未通过`,
            `备注: ${reviewed.approvalNote || '无'}`,
          ].join('\n'),
        },
      );

      await sendMail({
        to: [reviewed.email],
        subject: rendered.subject,
        text: rendered.bodyText,
      });
    } catch (error) {
      console.error('join request rejected mail failed:', error);
    }

    return reviewed;
  }

  const reviewed = await prisma.$transaction(async (tx) => {
    const [existingUsername, existingEmail, existingTeam] = await Promise.all([
      tx.admin.findUnique({ where: { username: request.requestedUsername }, select: { id: true } }),
      tx.admin.findUnique({ where: { email: request.email }, select: { id: true } }),
      tx.team.findUnique({
        where: {
          serverName_guildName_name: {
            serverName: request.serverName,
            guildName: request.guildName,
            name: request.teamName,
          },
        },
        select: { id: true },
      }),
    ]);

    if (existingUsername) {
      throw new Error('该操作员账号已存在，无法批准');
    }
    if (existingEmail) {
      throw new Error('该邮箱已绑定管理员账号，无法批准');
    }
    if (existingTeam) {
      throw new Error('该服务器/工会/团队已存在，无法批准');
    }

    const slug = await generateUniqueTeamSlug(request.teamName);

    const team = await tx.team.create({
      data: {
        name: request.teamName,
        serverName: request.serverName,
        guildName: request.guildName,
        slug,
      },
      select: { id: true },
    });

    const admin = await tx.admin.create({
      data: {
        username: request.requestedUsername,
        email: request.email,
        password: request.passwordHash,
        role: 'admin',
        isActive: true,
        needPasswordChange: false,
      },
      select: { id: true },
    });

    await tx.teamPermission.create({
      data: {
        adminId: admin.id,
        teamId: team.id,
      },
    });

    return tx.joinRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        approvalNote: normalizeText(approvalNote) || null,
        reviewedByAdminId: reviewerAdminId,
        reviewedAt: new Date(),
      },
    });
  });

  try {
    const rendered = await renderEmailTemplate(
      'join_request_approved_notify_applicant',
      {
        requestId: reviewed.id,
        serverName: reviewed.serverName,
        guildName: reviewed.guildName,
        teamName: reviewed.teamName,
        requestedUsername: reviewed.requestedUsername,
        email: reviewed.email,
        approvalNote: reviewed.approvalNote || '',
        reviewedAt: reviewed.reviewedAt?.toISOString() || '',
      },
      {
        subject: '[MyDKP] 入驻申请已通过',
        bodyText: [
          `申请ID: ${reviewed.id}`,
          `团队: ${reviewed.serverName} / ${reviewed.guildName} / ${reviewed.teamName}`,
          `操作员: ${reviewed.requestedUsername}`,
          '结果: 已通过',
        ].join('\n'),
      },
    );

    await sendMail({
      to: [reviewed.email],
      subject: rendered.subject,
      text: rendered.bodyText,
    });
  } catch (error) {
    console.error('join request approved mail failed:', error);
  }

  return reviewed;
}
