'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { UserPlus, Shield, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type AdminItem = {
  id: string;
  username: string;
  email?: string | null;
  role: 'super_admin' | 'admin';
  isActive: boolean;
  isProtected: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type PermissionTreeResponse = {
  admin: {
    id: string;
    username: string;
    role: 'super_admin' | 'admin';
  };
  selections: {
    rootAccess: boolean;
    serverAccesses: string[];
    guildAccesses: Array<{ serverName: string; guildName: string }>;
    teamIds: string[];
  };
  catalog: Array<{
    serverName: string;
    guilds: Array<{
      guildName: string;
      teams: Array<{
        id: string;
        name: string;
        slug: string | null;
      }>;
    }>;
  }>;
};

type PermissionState = PermissionTreeResponse['selections'];

interface Team {
  id: string;
  name: string;
  serverName?: string;
  guildName?: string;
}

interface AdminManagementProps {
  teams: Team[];
  currentAdminRole: string;
}

function guildKey(serverName: string, guildName: string) {
  return `${serverName}::${guildName}`;
}

export function AdminManagement({ currentAdminRole }: AdminManagementProps) {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'super_admin'>('admin');

  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [permissionTree, setPermissionTree] = useState<PermissionTreeResponse | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    rootAccess: false,
    serverAccesses: [],
    guildAccesses: [],
    teamIds: [],
  });
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);

  const selectedAdmin = useMemo(
    () => admins.find((admin) => admin.id === selectedAdminId) || null,
    [admins, selectedAdminId],
  );

  const serverSet = useMemo(() => new Set(permissionState.serverAccesses), [permissionState.serverAccesses]);
  const guildSet = useMemo(
    () => new Set(permissionState.guildAccesses.map((item) => guildKey(item.serverName, item.guildName))),
    [permissionState.guildAccesses],
  );
  const teamSet = useMemo(() => new Set(permissionState.teamIds), [permissionState.teamIds]);

  useEffect(() => {
    if (currentAdminRole === 'super_admin') {
      loadAdmins();
    }
  }, [currentAdminRole]);

  useEffect(() => {
    const handleTeamsUpdated = () => {
      loadAdmins();
      if (selectedAdminId) {
        loadPermissionTree(selectedAdminId);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mydkp:teams-updated', handleTeamsUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mydkp:teams-updated', handleTeamsUpdated);
      }
    };
  }, [selectedAdminId]);

  useEffect(() => {
    if (!selectedAdminId) {
      setPermissionTree(null);
      return;
    }

    const selected = admins.find((item) => item.id === selectedAdminId);
    if (!selected || selected.role === 'super_admin') {
      setPermissionTree(null);
      return;
    }

    loadPermissionTree(selectedAdminId);
  }, [selectedAdminId, admins]);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取管理员列表失败');
      }

      const list = Array.isArray(data) ? data : [];
      setAdmins(list);

      if (list.length > 0) {
        setSelectedAdminId((prev) => (prev && list.some((item: AdminItem) => item.id === prev) ? prev : list[0].id));
      } else {
        setSelectedAdminId('');
      }
    } catch (error: any) {
      toast.error(error?.message || '获取管理员列表失败');
      setAdmins([]);
      setSelectedAdminId('');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissionTree = async (adminId: string) => {
    setPermissionLoading(true);
    try {
      const res = await fetch(`/api/admins/${adminId}/permissions-tree`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取授权目录失败');
      }

      setPermissionTree(data);
      setPermissionState({
        rootAccess: data.selections.rootAccess === true,
        serverAccesses: Array.isArray(data.selections.serverAccesses) ? data.selections.serverAccesses : [],
        guildAccesses: Array.isArray(data.selections.guildAccesses) ? data.selections.guildAccesses : [],
        teamIds: Array.isArray(data.selections.teamIds) ? data.selections.teamIds : [],
      });
    } catch (error: any) {
      toast.error(error?.message || '获取授权目录失败');
      setPermissionTree(null);
    } finally {
      setPermissionLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedAdmin) return;

    setPermissionSaving(true);
    try {
      const res = await fetch(`/api/admins/${selectedAdmin.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionState),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存授权失败');
      }

      toast.success('授权已保存');
      await Promise.all([loadAdmins(), loadPermissionTree(selectedAdmin.id)]);
    } catch (error: any) {
      toast.error(error?.message || '保存授权失败');
    } finally {
      setPermissionSaving(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!username.trim() || !password) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim() || null,
          password,
          role: selectedRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '创建失败');
        if (Array.isArray(data.details)) {
          data.details.forEach((item: string) => toast.warning(item));
        }
        return;
      }

      toast.success('管理员创建成功');
      setIsCreateOpen(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setSelectedRole('admin');
      await loadAdmins();
      if (data?.admin?.id) {
        setSelectedAdminId(data.admin.id);
      }
    } catch (error) {
      toast.error('创建失败，请重试');
    }
  };

  const handlePromote = async (admin: AdminItem) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'super_admin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '提升失败');
      }
      toast.success(`${admin.username} 已提升为超级管理员`);
      await loadAdmins();
    } catch (error: any) {
      toast.error(error?.message || '提升失败');
    }
  };

  const handleDemote = async (admin: AdminItem) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '降级失败');
      }
      toast.success(`${admin.username} 已降级为普通管理员`);
      await loadAdmins();
    } catch (error: any) {
      toast.error(error?.message || '降级失败');
    }
  };

  const handleToggleActive = async (admin: AdminItem) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '操作失败');
      }
      toast.success(admin.isActive ? '已禁用管理员' : '已启用管理员');
      await loadAdmins();
    } catch (error: any) {
      toast.error(error?.message || '操作失败');
    }
  };

  const handleDelete = async (admin: AdminItem) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }
      toast.success('管理员已删除');
      await loadAdmins();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
    }
  };

  const hasTeamAccess = (serverName: string, guildName: string, teamId: string) => {
    if (permissionState.rootAccess) return true;
    if (serverSet.has(serverName)) return true;
    if (guildSet.has(guildKey(serverName, guildName))) return true;
    return teamSet.has(teamId);
  };

  const toggleRoot = (checked: boolean) => {
    setPermissionState((prev) => ({
      ...prev,
      rootAccess: checked,
    }));
  };

  const toggleServer = (serverName: string, checked: boolean) => {
    setPermissionState((prev) => {
      const next = new Set(prev.serverAccesses);
      if (checked) {
        next.add(serverName);
      } else {
        next.delete(serverName);
      }
      return {
        ...prev,
        serverAccesses: Array.from(next),
      };
    });
  };

  const toggleGuild = (serverName: string, guildName: string, checked: boolean) => {
    setPermissionState((prev) => {
      const key = guildKey(serverName, guildName);
      const next = new Map(prev.guildAccesses.map((item) => [guildKey(item.serverName, item.guildName), item]));
      if (checked) {
        next.set(key, { serverName, guildName });
      } else {
        next.delete(key);
      }
      return {
        ...prev,
        guildAccesses: Array.from(next.values()),
      };
    });
  };

  const toggleTeam = (teamId: string, checked: boolean) => {
    setPermissionState((prev) => {
      const next = new Set(prev.teamIds);
      if (checked) {
        next.add(teamId);
      } else {
        next.delete(teamId);
      }
      return {
        ...prev,
        teamIds: Array.from(next),
      };
    });
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
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <UserPlus className="h-4 w-4 mr-2" />
            创建管理员
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-8 text-gray-400">暂无管理员</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {admins.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => setSelectedAdminId(admin.id)}
                  className={`w-full text-left rounded border p-3 transition-colors ${
                    selectedAdminId === admin.id
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-slate-700 bg-slate-900/40 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-gray-100 font-semibold">{admin.username}</div>
                      <div className="text-xs text-gray-400">{admin.email || '未设置邮箱'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded border ${
                          admin.role === 'super_admin'
                            ? 'bg-yellow-900/40 border-yellow-700 text-yellow-300'
                            : 'bg-slate-800 border-slate-600 text-gray-300'
                        }`}
                      >
                        {admin.role}
                      </span>
                      {!admin.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded border bg-red-900/40 border-red-700 text-red-300">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    最后登录：{admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('zh-CN') : '暂无'}
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded border border-slate-700 bg-slate-900/40 p-4 min-h-[520px]">
              {!selectedAdmin ? (
                <div className="text-gray-400">请选择管理员</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-gray-100 font-semibold">{selectedAdmin.username}</div>
                      <div className="text-xs text-gray-400">{selectedAdmin.email || '未设置邮箱'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAdmin.role === 'super_admin' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">降级</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-800 border-orange-900">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-gray-100">确认降级为普通管理员？</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                该操作会移除超级管理员身份。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDemote(selectedAdmin)}>确认降级</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">提升</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-800 border-yellow-900">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-gray-100">确认提升为超级管理员？</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                提升后将拥有全部权限。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePromote(selectedAdmin)}>确认提升</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(selectedAdmin)}>
                        {selectedAdmin.isActive ? '禁用' : '启用'}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={selectedAdmin.isProtected}>
                            <Trash2 className="h-4 w-4 mr-1" /> 删除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-800 border-red-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-gray-100">确认删除管理员？</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                              删除后将移除该管理员所有权限，且无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(selectedAdmin)}>确认删除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {selectedAdmin.role === 'super_admin' ? (
                    <div className="rounded border border-yellow-700 bg-yellow-900/20 p-3 text-yellow-200 text-sm">
                      超级管理员默认拥有全部团队权限（根权限继承）。
                    </div>
                  ) : permissionLoading ? (
                    <div className="text-gray-400">加载授权目录中...</div>
                  ) : !permissionTree ? (
                    <div className="text-gray-400">授权目录加载失败</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-gray-200">
                          <Checkbox checked={permissionState.rootAccess} onCheckedChange={(v) => toggleRoot(v === true)} />
                          根权限（继承全部服务器/工会/团队）
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadPermissionTree(selectedAdmin.id)}
                          disabled={permissionLoading}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" /> 刷新目录
                        </Button>
                      </div>

                      <div className="max-h-[330px] overflow-y-auto rounded border border-slate-700 p-3 space-y-3 bg-slate-950/30">
                        {permissionTree.catalog.map((server) => {
                          const serverChecked = permissionState.rootAccess || serverSet.has(server.serverName);
                          const serverInherited = permissionState.rootAccess;

                          return (
                            <div key={server.serverName} className="space-y-2">
                              <label className="flex items-center gap-2 text-blue-200">
                                <Checkbox
                                  checked={serverChecked}
                                  disabled={serverInherited}
                                  onCheckedChange={(v) => toggleServer(server.serverName, v === true)}
                                />
                                服务器：{server.serverName}
                              </label>

                              <div className="pl-6 space-y-2">
                                {server.guilds.map((guild) => {
                                  const key = guildKey(server.serverName, guild.guildName);
                                  const guildChecked = permissionState.rootAccess || serverSet.has(server.serverName) || guildSet.has(key);
                                  const guildInherited = permissionState.rootAccess || serverSet.has(server.serverName);

                                  return (
                                    <div key={key} className="space-y-1">
                                      <label className="flex items-center gap-2 text-purple-200">
                                        <Checkbox
                                          checked={guildChecked}
                                          disabled={guildInherited}
                                          onCheckedChange={(v) => toggleGuild(server.serverName, guild.guildName, v === true)}
                                        />
                                        工会：{guild.guildName}
                                      </label>

                                      <div className="pl-6 grid grid-cols-1 gap-1">
                                        {guild.teams.map((team) => {
                                          const inherited =
                                            permissionState.rootAccess ||
                                            serverSet.has(server.serverName) ||
                                            guildSet.has(key);

                                          const checked = hasTeamAccess(server.serverName, guild.guildName, team.id);

                                          return (
                                            <label key={team.id} className="flex items-center gap-2 text-gray-300 text-sm">
                                              <Checkbox
                                                checked={checked}
                                                disabled={inherited}
                                                onCheckedChange={(v) => toggleTeam(team.id, v === true)}
                                              />
                                              {team.name} {team.slug ? `(${team.slug})` : '(无短链)'}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={savePermissions} disabled={permissionSaving}>
                          {permissionSaving ? '保存中...' : '保存授权'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

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
                  <SelectItem value="admin" className="text-gray-200">普通管理员</SelectItem>
                  <SelectItem value="super_admin" className="text-gray-200">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-200">用户名</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-slate-900/50 border-slate-600 text-gray-200" />
            </div>
            <div>
              <Label className="text-gray-200">邮箱</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-900/50 border-slate-600 text-gray-200" />
            </div>
            <div>
              <Label className="text-gray-200">密码</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-900/50 border-slate-600 text-gray-200" />
              <p className="text-xs text-gray-500 mt-1">至少8位，包含大小写字母、数字和特殊字符</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreateAdmin}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
