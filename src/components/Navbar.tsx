'use client';

import { useState } from 'react';
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
import { LogIn, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Team } from '@/types';

interface NavbarProps {
  teams: Team[];
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
  isAdmin: boolean;
  onAuthChange: (isAdmin: boolean) => void;
}

export function Navbar({
  teams,
  selectedTeam,
  onTeamChange,
  isAdmin,
  onAuthChange,
}: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
        toast.success('登录成功！');
        onAuthChange(true);
        setIsLoginOpen(false);
        setUsername('');
        setPassword('');
      } else {
        toast.error(data.error || '登录失败');
      }
    } catch (error) {
      toast.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('已退出登录');
      onAuthChange(false);
    } catch (error) {
      toast.error('退出失败');
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-600">
              ⚔️ WoW DKP Manager
            </h1>
            
            {teams.length > 0 && (
              <Select value={selectedTeam} onValueChange={onTeamChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择团队" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({team._count?.players || 0}人)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin ? (
              <>
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Shield className="h-4 w-4" />
                  <span>管理员模式</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </Button>
              </>
            ) : (
              <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    管理员登录
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>管理员登录</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="username">用户名</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
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