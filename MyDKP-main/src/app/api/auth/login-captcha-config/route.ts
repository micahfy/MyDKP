import { NextResponse } from 'next/server';
import { getAdminLoginCaptchaPolicy } from '@/lib/systemSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const policy = await getAdminLoginCaptchaPolicy();
    return NextResponse.json({
      required: policy.required,
      enabled: policy.enabled,
      emergencyBypass: policy.emergencyBypass,
      configured: policy.configured,
      identity: policy.identity,
      sceneId: policy.sceneId,
      region: policy.region,
    });
  } catch (error) {
    console.error('get login captcha config error:', error);
    return NextResponse.json({ error: 'Failed to load captcha config' }, { status: 500 });
  }
}
