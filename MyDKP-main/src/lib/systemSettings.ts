import { prisma } from '@/lib/prisma';

export const JOIN_REQUEST_NOTIFY_EMAIL_KEY = 'join_request_notify_email';

export async function getSystemSetting(key: string) {
  const record = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return record?.value ?? null;
}

export async function setSystemSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getJoinRequestNotifyEmail() {
  const value = await getSystemSetting(JOIN_REQUEST_NOTIFY_EMAIL_KEY);
  return (value || '').trim().toLowerCase();
}
