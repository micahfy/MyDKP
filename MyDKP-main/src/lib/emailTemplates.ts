import { prisma } from '@/lib/prisma';

export const EMAIL_TEMPLATE_KEYS = [
  'admin_password_reset',
  'sensitive_alert_summary',
  'join_request_verification_code',
  'join_request_submitted_notify_admin',
  'join_request_approved_notify_applicant',
  'join_request_rejected_notify_applicant',
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

type EmailTemplateSeed = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyText: string;
};

const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateSeed> = {
  admin_password_reset: {
    key: 'admin_password_reset',
    name: '管理员密码找回',
    description: '管理员点击邮件链接重置密码',
    subject: '[MyDKP] 重置密码 - {{username}}',
    bodyText: [
      '你好 {{username}}，',
      '',
      '我们收到你的密码重置请求，请在 {{expiresMinutes}} 分钟内点击以下链接完成重置：',
      '{{resetLink}}',
      '',
      '如果不是你本人操作，请忽略这封邮件。',
      '',
      '请求时间：{{requestTime}}',
    ].join('\n'),
  },
  sensitive_alert_summary: {
    key: 'sensitive_alert_summary',
    name: '敏感词告警汇总',
    description: '敏感词命中记录的批量汇总邮件',
    subject: '[MyDKP Sensitive Alert] {{batchCount}} records (teams:{{teamCount}})',
    bodyText: [
      'Sensitive content detected in MyDKP.',
      '',
      'Batch Count: {{batchCount}}',
      'Time Range: {{timeRange}}',
      'Source Types: {{sourceTypes}}',
      '',
      '{{records}}',
    ].join('\n'),
  },
  join_request_verification_code: {
    key: 'join_request_verification_code',
    name: '入驻申请验证码',
    description: '申请加入时发送给申请邮箱的验证码',
    subject: '[MyDKP] 入驻申请邮箱验证码',
    bodyText: [
      '邮箱：{{email}}',
      '验证码：{{code}}',
      '有效期：{{expiresMinutes}} 分钟',
      '请求时间：{{requestTime}}',
      '',
      '如果不是你本人操作，请忽略这封邮件。',
    ].join('\n'),
  },
  join_request_submitted_notify_admin: {
    key: 'join_request_submitted_notify_admin',
    name: '入驻申请通知管理员',
    description: '有新申请提交时通知指定超管邮箱',
    subject: '[MyDKP] 新入驻申请待审批 - {{teamName}}',
    bodyText: [
      '申请ID：{{requestId}}',
      '服务器：{{serverName}}',
      '工会：{{guildName}}',
      '团队：{{teamName}}',
      '操作员账号：{{requestedUsername}}',
      '申请邮箱：{{email}}',
      '提交时间：{{createdAt}}',
      '',
      '请登录后台进行审批。',
    ].join('\n'),
  },
  join_request_approved_notify_applicant: {
    key: 'join_request_approved_notify_applicant',
    name: '入驻申请通过通知',
    description: '申请通过后发送给申请人',
    subject: '[MyDKP] 入驻申请已通过 - {{teamName}}',
    bodyText: [
      '申请ID：{{requestId}}',
      '服务器：{{serverName}}',
      '工会：{{guildName}}',
      '团队：{{teamName}}',
      '操作员账号：{{requestedUsername}}',
      '审核时间：{{reviewedAt}}',
      '备注：{{approvalNote}}',
      '',
      '你的团队和管理员账号已创建成功。',
    ].join('\n'),
  },
  join_request_rejected_notify_applicant: {
    key: 'join_request_rejected_notify_applicant',
    name: '入驻申请拒绝通知',
    description: '申请拒绝后发送给申请人',
    subject: '[MyDKP] 入驻申请未通过 - {{teamName}}',
    bodyText: [
      '申请ID：{{requestId}}',
      '服务器：{{serverName}}',
      '工会：{{guildName}}',
      '团队：{{teamName}}',
      '操作员账号：{{requestedUsername}}',
      '审核时间：{{reviewedAt}}',
      '备注：{{approvalNote}}',
      '',
      '如需补充信息，请重新提交申请。',
    ].join('\n'),
  },
};

type TemplateVariables = Record<string, string | number | null | undefined>;

function renderTemplate(raw: string, variables: TemplateVariables) {
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

async function ensureEmailTemplateSeed(key: EmailTemplateKey) {
  const seed = DEFAULT_EMAIL_TEMPLATES[key];
  await prisma.emailTemplate.upsert({
    where: { key: seed.key },
    create: {
      key: seed.key,
      name: seed.name,
      description: seed.description,
      subject: seed.subject,
      bodyText: seed.bodyText,
    },
    update: {},
  });
}

export async function ensureEmailTemplateSeeds() {
  for (const key of EMAIL_TEMPLATE_KEYS) {
    await ensureEmailTemplateSeed(key);
  }
}

export async function listEmailTemplates() {
  await ensureEmailTemplateSeeds();
  return prisma.emailTemplate.findMany({
    orderBy: { key: 'asc' },
  });
}

export async function updateEmailTemplateByKey(
  key: EmailTemplateKey,
  payload: { subject: string; bodyText: string },
) {
  await ensureEmailTemplateSeed(key);
  const subject = (payload.subject || '').trim();
  const bodyText = (payload.bodyText || '').trim();

  if (!subject) {
    throw new Error('模板主题不能为空');
  }
  if (!bodyText) {
    throw new Error('模板正文不能为空');
  }

  return prisma.emailTemplate.update({
    where: { key },
    data: {
      subject,
      bodyText,
    },
  });
}

export async function resetEmailTemplateToDefault(key: EmailTemplateKey) {
  const seed = DEFAULT_EMAIL_TEMPLATES[key];
  return prisma.emailTemplate.upsert({
    where: { key: seed.key },
    create: {
      key: seed.key,
      name: seed.name,
      description: seed.description,
      subject: seed.subject,
      bodyText: seed.bodyText,
    },
    update: {
      name: seed.name,
      description: seed.description,
      subject: seed.subject,
      bodyText: seed.bodyText,
    },
  });
}

export async function renderEmailTemplate(
  key: EmailTemplateKey,
  variables: TemplateVariables,
  fallback?: { subject: string; bodyText: string },
) {
  await ensureEmailTemplateSeed(key);
  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  const subjectTemplate = template?.subject || fallback?.subject || DEFAULT_EMAIL_TEMPLATES[key].subject;
  const bodyTemplate = template?.bodyText || fallback?.bodyText || DEFAULT_EMAIL_TEMPLATES[key].bodyText;

  return {
    subject: renderTemplate(subjectTemplate, variables),
    bodyText: renderTemplate(bodyTemplate, variables),
  };
}
