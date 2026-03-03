'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('缺少重置令牌');
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('密码重置成功，请重新登录。');
        router.push('/');
      } else {
        toast.error(data.error || '重置密码失败');
        if (Array.isArray(data.details)) {
          data.details.forEach((msg: string) => toast.warning(msg));
        }
      }
    } catch (error) {
      toast.error('重置密码失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/80 border-slate-700">
        <CardHeader>
          <CardTitle>重置管理员密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="token">重置令牌</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="邮件链接中的 token"
                className="bg-slate-950/60 border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8位，包含大小写字母/数字/特殊字符"
                className="bg-slate-950/60 border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className="bg-slate-950/60 border-slate-700"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '提交中...' : '确认重置'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
