import { prisma } from '@/lib/prisma';

export const JOIN_REQUEST_NOTIFY_EMAIL_KEY = 'join_request_notify_email';
export const DEFAULT_LOGIN_TEAM_ID_KEY = 'default_login_team_id';
export const ADMIN_LOGIN_CAPTCHA_ENABLED_KEY = 'admin_login_captcha_enabled';

type AdminLoginCaptchaConfig = {
  identity: string;
  sceneId: string;
  region: string;
  configured: boolean;
};

type AdminLoginCaptchaPolicy = {
  enabled: boolean;
  emergencyBypass: boolean;
  required: boolean;
} & AdminLoginCaptchaConfig;

function toBool(value: string | null | undefined, defaultValue = false) {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

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

export async function getDefaultLoginTeamId() {
  const value = await getSystemSetting(DEFAULT_LOGIN_TEAM_ID_KEY);
  return (value || '').trim();
}

export async function getAdminLoginCaptchaEnabled() {
  const value = await getSystemSetting(ADMIN_LOGIN_CAPTCHA_ENABLED_KEY);
  return toBool(value, false);
}

export async function setAdminLoginCaptchaEnabled(enabled: boolean) {
  return setSystemSetting(ADMIN_LOGIN_CAPTCHA_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function getAdminLoginCaptchaConfigFromEnv(): AdminLoginCaptchaConfig {
  const identity = String(process.env.ESA_AI_CAPTCHA_IDENTITY || '').trim();
  const sceneId = String(process.env.ESA_AI_CAPTCHA_SCENE_ID || '').trim();
  const region = String(process.env.ESA_AI_CAPTCHA_REGION || '').trim().toLowerCase() || 'cn';

  return {
    identity,
    sceneId,
    region,
    configured: Boolean(identity && sceneId && region),
  };
}

export function isAdminLoginCaptchaEmergencyBypassEnabled() {
  return toBool(process.env.ADMIN_LOGIN_CAPTCHA_EMERGENCY_BYPASS, false);
}

export async function getAdminLoginCaptchaPolicy(): Promise<AdminLoginCaptchaPolicy> {
  const enabled = await getAdminLoginCaptchaEnabled();
  const emergencyBypass = isAdminLoginCaptchaEmergencyBypassEnabled();
  const config = getAdminLoginCaptchaConfigFromEnv();

  return {
    enabled,
    emergencyBypass,
    required: enabled && !emergencyBypass,
    ...config,
  };
}
