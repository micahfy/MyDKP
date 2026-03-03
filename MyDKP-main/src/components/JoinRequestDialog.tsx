'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function JoinRequestDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const [serverName, setServerName] = useState('');
  const [guildName, setGuildName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [requestedUsername, setRequestedUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const resetForm = () => {
    setServerName('');
    setGuildName('');
    setTeamName('');
    setRequestedUsername('');
    setPassword('');
    setEmail('');
    setVerificationCode('');
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      toast.error('请先输入邮箱');
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch('/api/join-requests/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '发送验证码失败');
      }
      if (data.throttled) {
        toast.warning(data.message || '发送过于频繁，请稍后再试');
      } else {
        toast.success(data.message || '验证码已发送');
      }
    } catch (error: any) {
      toast.error(error?.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!serverName || !guildName || !teamName || !requestedUsername || !password || !email || !verificationCode) {
      toast.error('请完整填写申请信息');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName,
          guildName,
          teamName,
          requestedUsername,
          password,
          email,
          verificationCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '提交申请失败');
      }

      toast.success(data.message || '申请已提交');
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || '提交申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="border-emerald-700 text-emerald-300 hover:bg-emerald-950">
          申请加入
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-100">申请加入 MyDKP</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-gray-300">所在服务器</Label>
            <Input value={serverName} onChange={(e) => setServerName(e.target.value)} className="bg-slate-900/60 border-slate-600 text-gray-200" />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">所在工会</Label>
            <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} className="bg-slate-900/60 border-slate-600 text-gray-200" />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">团队名称</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="bg-slate-900/60 border-slate-600 text-gray-200" />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">操作员账号</Label>
            <Input value={requestedUsername} onChange={(e) => setRequestedUsername(e.target.value)} className="bg-slate-900/60 border-slate-600 text-gray-200" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-gray-300">登录密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位，包含大小写字母、数字和特殊字符"
              className="bg-slate-900/60 border-slate-600 text-gray-200"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-gray-300">邮箱地址</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-900/60 border-slate-600 text-gray-200"
              />
              <Button type="button" variant="secondary" onClick={handleSendCode} disabled={sendingCode}>
                {sendingCode ? '发送中...' : '发送验证码'}
              </Button>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-gray-300">邮箱验证码</Label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="bg-slate-900/60 border-slate-600 text-gray-200"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '提交申请'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
