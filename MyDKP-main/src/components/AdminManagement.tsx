'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserPlus, Edit2, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface Admin {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  teamPermissions: Array<{
    team: {
      id: string;
      name: string;
    };
  }>;
}

interface Team {
  id: string;
  name: string;
}

interface AdminManagementProps {
  teams: Team[];
  currentAdminRole: string;
}

export function AdminManagement({ teams: propTeams = [], currentAdminRole }: AdminManagementProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);

  // 创建管理员表单
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // 确保 teams 是数组
  const teams = Array.isArray(propTeams) ? propTeams : [];

  useEffect(() => {
    if (currentAdminRole === 'super_admin') {
      fetchAdmins();
    }
  }, [currentAdminRole]);

  useEffect(() => {
    if (editingAdmin) {
      setEditTeamIds(editingAdmin.teamPermissions.map(p => p.team.id));
    }
  }, [editingAdmin]);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch admins');
        setAdmins([]);
        toast.error('获取管理员列表失败');
      }
    } catch (error) {
      console.error('Fetch admins error:', error);
      setAdmins([]);
      toast.error('获取管理员列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增：管理员角色选择
  const [selectedRole, setSelectedRole] = useState<'admin' | 'super_admin'>('admin');

  const handleCreateAdmin = async () => {
    if (!username || !password) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role: selectedRole,
          teamIds: selectedRole === 'super_admin' ? [] : selectedTeams, // 超管不需要团队权限
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('管理员创建成功！');
        setIsCreateOpen(false);
        setUsername('');
        setPassword('');
        setSelectedTeams([]);
        setSelectedRole('admin');
        fetchAdmins();
      } else {
        toast.error(data.error || '创建失败');
        if (data.details) {
          data.details.forEach((msg: string) => toast.warning(msg));
        }
      }
    } catch (error) {
      toast.error('创建失败，请重试');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingAdmin) return;

    try {
      const res = await fetch(`/api/admins/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamIds: editTeamIds,
          role: editingAdmin.role, // 保持角色不变
        }),
      });

      if (res.ok) {
        toast.success('权限更新成功！');
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        toast.error('权限更新失败');
      }
    } catch (error) {
      toast.error('权限更新失败');
    }
  };

  const handlePromoteToSuperAdmin = async (adminId: string, username: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'super_admin' }),
      });

      if (res.ok) {
        toast.success(`${username} 已提升为超级管理员`);
        fetchAdmins();
      } else {
        toast.error('提升失败');
      }
    } catch (error) {
      toast.error('提升失败');
    }
  };

  const handleDemoteToAdmin = async (adminId: string, username: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });

      if (res.ok) {
        toast.success(`${username} 已降级为普通管理员`);
        fetchAdmins();
      } else {
        toast.error('降级失败');
      }
    } catch (error) {
      toast.error('降级失败');
    }
  };
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        toast.success(isActive ? '已禁用管理员' : '已启用管理员');
        fetchAdmins();
      } else {
        toast.error('操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('管理员已删除');
        fetchAdmins();
      } else {
        const data = await res.json();
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  if (currentAdminRole !== 'super_admin') {
    return (
      <Card className="p-6 bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-700/50">
        <div className="text-center text-gray-300">
          <Shield className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p>仅超级管理员可以管理其他管理员</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-gray-100">管理员列表</h3>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            创建管理员
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4">加载中...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-8 text-gray-400">暂无管理员</div>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-semibold text-gray-100">
                      {admin.username}
                    </span>
                    {admin.role === 'super_admin' && (
                      <span className="px-2 py-1 text-xs rounded bg-yellow-900/50 text-yellow-400 border border-yellow-600">
                        超级管理员
                      </span>
                    )}
                    {!admin.isActive && (
                      <span className="px-2 py-1 text-xs rounded bg-red-900/50 text-red-400 border border-red-600">
                        已禁用
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-gray-400">
                    {admin.teamPermissions.length > 0 ? (
                      <span>
                        权限团队：
                        {admin.teamPermissions.map((p) => p.team.name).join('、')}
                      </span>
                    ) : (
                      <span>无团队权限</span>
                    )}
                  </div>
                  {admin.lastLoginAt && (
                    <div className="mt-1 text-xs text-gray-500">
                      最后登录：{new Date(admin.lastLoginAt).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>

                {admin.role !== 'super_admin' && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePromoteToSuperAdmin(admin.id, admin.username)}
                      className="text-yellow-400 hover:bg-yellow-950"
                      title="提升为超级管理员"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAdmin(admin)}
                      className="text-blue-400 hover:bg-blue-950"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(admin.id, admin.isActive)}
                      className={
                        admin.isActive
                          ? 'text-orange-400 hover:bg-orange-950'
                          : 'text-green-400 hover:bg-green-950'
                      }
                    >
                      {admin.isActive ? '禁用' : '启用'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-800 border-red-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-gray-100">
                            确认删除管理员？
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-400">
                            此操作将删除管理员 <strong>{admin.username}</strong> 及其所有权限，无法撤销！
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-700">取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 创建管理员对话框 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-800 border-purple-900">
          <DialogHeader>
            <DialogTitle className="text-gray-100">创建新管理员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-200">管理员角色</Label>
              <Select value={selectedRole} onValueChange={(value: 'admin' | 'super_admin') => setSelectedRole(value)}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="admin" className="hover:bg-blue-950 text-gray-200">
                    普通管理员
                  </SelectItem>
                  <SelectItem value="super_admin" className="hover:bg-blue-950 text-gray-200">
                    超级管理员
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedRole === 'super_admin' ? '超级管理员拥有所有权限' : '普通管理员需要授权团队'}
              </p>
            </div>
            <div>
              <Label className="text-gray-200">用户名</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="bg-slate-900/50 border-slate-600 text-gray-200"
              />
            </div>
            <div>
              <Label className="text-gray-200">密码</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少8位，包含大小写字母、数字和特殊字符"
                className="bg-slate-900/50 border-slate-600 text-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                密码要求：至少8位，包含大小写字母、数字和特殊字符
              </p>
            </div>
            <div>
              <Label className="text-gray-200">授权团队</Label>
              {selectedRole === 'super_admin' ? (
                <div className="text-center py-4 text-gray-400 bg-slate-900/50 rounded-lg border border-yellow-700/50">
                  超级管理员自动拥有所有团队权限
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-4 text-gray-500 bg-slate-900/50 rounded-lg">
                  暂无可用团队，请先创建团队
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className="flex items-center space-x-2 p-2 rounded bg-slate-900/50 cursor-pointer hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeams([...selectedTeams, team.id]);
                          } else {
                            setSelectedTeams(selectedTeams.filter((id) => id !== team.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-200">{team.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="bg-slate-700"
            >
              取消
            </Button>
            <Button onClick={handleCreateAdmin} className="bg-gradient-to-r from-purple-600 to-blue-600">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑权限对话框 */}
      {editingAdmin && (
        <Dialog open={!!editingAdmin} onOpenChange={() => setEditingAdmin(null)}>
          <DialogContent className="bg-slate-800 border-blue-900">
            <DialogHeader>
              <DialogTitle className="text-gray-100">
                编辑 {editingAdmin.username} 的权限
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-200">授权团队</Label>
                {teams.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 bg-slate-900/50 rounded-lg">
                    暂无可用团队
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                    {teams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center space-x-2 p-2 rounded bg-slate-900/50 cursor-pointer hover:bg-slate-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={editTeamIds.includes(team.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTeamIds([...editTeamIds, team.id]);
                            } else {
                              setEditTeamIds(editTeamIds.filter((id) => id !== team.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-200">{team.name}</span>
                      </label>
                    )                    )}
                  </div>
                )}
                {admin.role === 'super_admin' && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDemoteToAdmin(admin.id, admin.username)}
                      className="text-orange-400 hover:bg-orange-950"
                      title="降级为普通管理员"
                    >
                      降级
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingAdmin(null)}
                className="bg-slate-700"
              >
                取消
              </Button>
              <Button onClick={handleUpdatePermissions} className="bg-gradient-to-r from-blue-600 to-purple-600">
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}