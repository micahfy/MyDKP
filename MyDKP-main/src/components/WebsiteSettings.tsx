'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function WebsiteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminLoginCaptchaEnabled, setAdminLoginCaptchaEnabled] = useState(false);
  const [adminLoginCaptchaEmergencyBypass, setAdminLoginCaptchaEmergencyBypass] = useState(false);
  const [adminLoginCaptchaConfigured, setAdminLoginCaptchaConfigured] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-settings');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load website settings');
      }

      setAdminLoginCaptchaEnabled(Boolean(data.adminLoginCaptchaEnabled));
      setAdminLoginCaptchaEmergencyBypass(Boolean(data.adminLoginCaptchaEmergencyBypass));
      setAdminLoginCaptchaConfigured(Boolean(data.adminLoginCaptchaConfigured));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load website settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminLoginCaptchaEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save website settings');
      }

      setAdminLoginCaptchaEnabled(Boolean(data.adminLoginCaptchaEnabled));
      setAdminLoginCaptchaEmergencyBypass(Boolean(data.adminLoginCaptchaEmergencyBypass));
      setAdminLoginCaptchaConfigured(Boolean(data.adminLoginCaptchaConfigured));
      toast.success('Website settings saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save website settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-700/60">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-300" />
            Website Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded border border-slate-700 bg-slate-900/40 p-3">
                <div>
                  <Label className="text-gray-100">Admin Login Puzzle Captcha</Label>
                  <p className="text-xs text-gray-400 mt-1">
                    When enabled, admin login requires ESA AI captcha verification after username and
                    password are entered.
                  </p>
                </div>
                <Checkbox
                  checked={adminLoginCaptchaEnabled}
                  onCheckedChange={(value) => setAdminLoginCaptchaEnabled(value === true)}
                />
              </div>

              <div
                className={`rounded border p-3 text-xs ${
                  adminLoginCaptchaConfigured
                    ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
                    : 'border-red-800/60 bg-red-950/30 text-red-200'
                }`}
              >
                {adminLoginCaptchaConfigured
                  ? 'ESA captcha environment variables are configured.'
                  : 'ESA captcha environment variables are incomplete. Check identity, scene ID, and region in .env.'}
              </div>

              <div
                className={`rounded border p-3 text-xs ${
                  adminLoginCaptchaEmergencyBypass
                    ? 'border-amber-800/60 bg-amber-950/30 text-amber-200'
                    : 'border-slate-700 bg-slate-900/30 text-gray-300'
                }`}
              >
                {adminLoginCaptchaEmergencyBypass
                  ? 'Emergency bypass is ON: admin login captcha is skipped regardless of website setting.'
                  : 'Emergency bypass is OFF: website setting controls whether captcha is required.'}
              </div>

              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Website Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
