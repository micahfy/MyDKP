'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    if (newPassword === oldPassword) {
      toast.error('新密码不能与旧密码相同');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admins/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('密码修改成功！');
        setOpen(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || '修改失败');
        if (data.details) {
          data.details.forEach((msg: string) => toast.warning(msg));
        }
      }
    } catch (error) {
      toast.error('修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-blue-700 text-blue-400 hover:bg-blue-950"
        >
          <Key className="h-4 w-4 mr-2" />
          修改密码
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-blue-900">
        <DialogHeader>
          <DialogTitle className="text-gray-100 flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-400" />
            <span>修改密码</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-200">原密码</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入原密码"
              required
              className="bg-slate-900/50 border-slate-600 text-gray-200"
            />
          </div>
          <div>
            <Label className="text-gray-200">新密码</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少8位，包含大小写字母、数字和特殊字符"
              required
              className="bg-slate-900/50 border-slate-600 text-gray-200"
            />
          </div>
          <div>
            <Label className="text-gray-200">确认新密码</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              className="bg-slate-900/50 border-slate-600 text-gray-200"
            />
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-300">
                <p className="font-semibold mb-1 text-blue-300">密码要求：</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>至少8个字符</li>
                  <li>包含大写字母（A-Z）</li>
                  <li>包含小写字母（a-z）</li>
                  <li>包含数字（0-9）</li>
                  <li>包含特殊字符（如 !@#$%^&*）</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="bg-slate-700"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {loading ? '修改中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}