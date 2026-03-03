'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, LogOut, Shield, Swords, User } from 'lucide-react';
import { toast } from 'sonner';
import { Team } from '@/types';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface NavbarProps {
  teams: Team[];
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
  isAdmin: boolean;
  onAuthChange: (isAdmin: boolean) => void;
  onLoginSuccess?: () => void | Promise<void>;
}

export function Navbar({
  teams,
  selectedTeam,
  onTeamChange,
  isAdmin,
  onAuthChange,
  onLoginSuccess,
}: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchCurrentUser();
    } else {
      setCurrentUser(null);
    }
  }, [isAdmin]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.isAdmin && data.username) {
        setCurrentUser({
          username: data.username,
          role: data.role,
        });
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('登录成功');
        onAuthChange(true);
        setIsLoginOpen(false);
        setUsername('');
        setPassword('');
        setShowForgotPassword(false);
        setForgotIdentifier('');
        fetchCurrentUser();
        if (onLoginSuccess) {
          await onLoginSuccess();
        }
      } else {
        toast.error(data.error || '登录失败');
      }
    } catch (error) {
      toast.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const identifier = forgotIdentifier.trim();
    if (!identifier) {
      toast.error('请输入用户名或邮箱');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '如账号存在，我们已发送重置邮件。');
      } else {
        toast.error(data.error || '发送重置邮件失败');
      }
    } catch (error) {
      toast.error('发送重置邮件失败');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('已退出登录');
      onAuthChange(false);
      setCurrentUser(null);
    } catch (error) {
      toast.error('退出失败');
    }
  };

  const handleLoginDialogChange = (open: boolean) => {
    setIsLoginOpen(open);
    if (!open) {
      setShowForgotPassword(false);
      setForgotIdentifier('');
    }
  };

  return (
    <nav className="navbar sticky top-0 z-50 border-b border-blue-900/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Swords className="h-8 w-8 text-yellow-400" />
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                WoW DKP Manager
              </h1>
            </div>

            {teams.length > 0 && (
              <Select value={selectedTeam} onValueChange={onTeamChange}>
                <SelectTrigger className="w-[200px] bg-slate-800/50 border-blue-900 text-gray-200">
                  <SelectValue placeholder="选择团队" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-blue-900">
                  {teams.map((team) => (
                    <SelectItem
                      key={team.id}
                      value={team.id}
                      className="hover:bg-blue-950 text-gray-200"
                    >
                      {team.serverName && team.guildName
                        ? `${team.serverName} / ${team.guildName} / ${team.name}`
                        : team.name}{' '}
                      {isAdmin && team._count ? `(${team._count.players}人)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin ? (
              <>
                <div className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50">
                  <Shield className="h-4 w-4 text-green-400" />
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <User className="h-3 w-3 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">
                        {currentUser?.username || '管理员'}
                      </span>
                    </div>
                    {currentUser?.role === 'super_admin' && (
                      <span className="text-xs text-yellow-400">超级管理员</span>
                    )}
                  </div>
                </div>
                <ChangePasswordDialog />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-red-700 text-red-400 hover:bg-red-950 btn-glow"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </Button>
              </>
            ) : (
              <Dialog open={isLoginOpen} onOpenChange={handleLoginDialogChange}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 btn-glow"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    管理员登录
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-blue-900">
                  <DialogHeader>
                    <DialogTitle className="text-gray-100 flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-400" />
                      <span>管理员登录</span>
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="username" className="text-gray-300">用户名</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        required
                        className="bg-slate-900/50 border-blue-900 text-gray-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-gray-300">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        required
                        className="bg-slate-900/50 border-blue-900 text-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-sm text-blue-300 hover:text-blue-200 hover:bg-transparent"
                        onClick={() => setShowForgotPassword((prev) => !prev)}
                      >
                        {showForgotPassword ? '收起密码找回' : '忘记密码？'}
                      </Button>

                      {showForgotPassword && (
                        <div className="space-y-2 rounded border border-slate-700 bg-slate-900/40 p-3">
                          <Label htmlFor="forgotIdentifier" className="text-gray-300">找回密码</Label>
                          <Input
                            id="forgotIdentifier"
                            value={forgotIdentifier}
                            onChange={(e) => setForgotIdentifier(e.target.value)}
                            placeholder="输入用户名或邮箱"
                            className="bg-slate-900/50 border-blue-900 text-gray-200"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-blue-700 text-blue-300 hover:bg-blue-950"
                            onClick={handleForgotPassword}
                            disabled={forgotLoading}
                          >
                            {forgotLoading ? '发送中...' : '发送重置邮件'}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      disabled={loading}
                    >
                      {loading ? '登录中...' : '登录'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
