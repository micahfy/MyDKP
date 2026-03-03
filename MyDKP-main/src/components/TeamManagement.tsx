'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Team } from '@/types';
import { TeamEditDialog } from './TeamEditDialog';
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

interface TeamManagementProps {
  onUpdate: () => void;
}

type ManageTeamRow = Team & {
  sortOrder?: number;
  updatedAt?: string;
};

type ServerOption = {
  serverName: string;
  count: number;
};

type GuildOption = {
  serverName: string;
  guildName: string;
  count: number;
};

const PAGE_SIZE = 20;

function guildKey(serverName: string, guildName: string) {
  return `${serverName}::${guildName}`;
}

export function TeamManagement({ onUpdate }: TeamManagementProps) {
  const [serverName, setServerName] = useState('');
  const [guildName, setGuildName] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [fetchLoading, setFetchLoading] = useState(true);
  const [teams, setTeams] = useState<ManageTeamRow[]>([]);
  const [editingTeam, setEditingTeam] = useState<ManageTeamRow | null>(null);

  const [search, setSearch] = useState('');
  const [filterServer, setFilterServer] = useState('all');
  const [filterGuildKey, setFilterGuildKey] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [guildOptions, setGuildOptions] = useState<GuildOption[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchServerName, setBatchServerName] = useState('');
  const [batchGuildName, setBatchGuildName] = useState('');
  const [batchSlugPrefix, setBatchSlugPrefix] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [defaultLoginTeamId, setDefaultLoginTeamId] = useState('');
  const [savingDefaultTeamId, setSavingDefaultTeamId] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const currentPageAllSelected = teams.length > 0 && teams.every((team) => selectedSet.has(team.id));

  useEffect(() => {
    fetchTeams();
  }, [page, filterServer, filterGuildKey]);

  useEffect(() => {
    fetchDefaultLoginTeamId();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeams();
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (filterGuildKey !== 'all') {
      const [server] = filterGuildKey.split('::');
      if (filterServer === 'all') {
        setFilterServer(server);
      }
    }
  }, [filterGuildKey]);

  const filteredGuildOptions = useMemo(() => {
    if (filterServer === 'all') return guildOptions;
    return guildOptions.filter((item) => item.serverName === filterServer);
  }, [guildOptions, filterServer]);

  const resetCreateForm = () => {
    setServerName('');
    setGuildName('');
    setName('');
    setSlug('');
    setDescription('');
  };

  const fetchTeams = async () => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search.trim()) params.set('q', search.trim());
      if (filterServer !== 'all') params.set('serverName', filterServer);
      if (filterGuildKey !== 'all') {
        const [server, guild] = filterGuildKey.split('::');
        if (server && guild) {
          params.set('serverName', server);
          params.set('guildName', guild);
        }
      }

      const res = await fetch(`/api/teams/manage?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取团队列表失败');
      }

      const list = Array.isArray(data.items) ? data.items : [];
      setTeams(list);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      setServerOptions(Array.isArray(data.serverOptions) ? data.serverOptions : []);
      setGuildOptions(Array.isArray(data.guildOptions) ? data.guildOptions : []);

      setSelectedIds((prev) => prev.filter((id) => list.some((team: ManageTeamRow) => team.id === id)));
    } catch (error: any) {
      console.error('Fetch teams error:', error);
      toast.error(error?.message || '获取团队列表失败');
      setTeams([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchDefaultLoginTeamId = async () => {
    try {
      const res = await fetch('/api/system-settings');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取默认团队设置失败');
      }
      setDefaultLoginTeamId(String(data.defaultLoginTeamId || ''));
    } catch (error: any) {
      console.error('Fetch default login team failed:', error);
    }
  };

  const handleSetDefaultLoginTeam = async (teamId: string) => {
    setSavingDefaultTeamId(teamId);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultLoginTeamId: teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '设置默认团队失败');
      }
      setDefaultLoginTeamId(String(data.defaultLoginTeamId || ''));
      toast.success('已设置为登录默认团队');
    } catch (error: any) {
      toast.error(error?.message || '设置默认团队失败');
    } finally {
      setSavingDefaultTeamId('');
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) {
      toast.error('请输入服务器名称');
      return;
    }
    if (!guildName.trim()) {
      toast.error('请输入工会名称');
      return;
    }
    if (!name.trim()) {
      toast.error('请输入团队名称');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName,
          guildName,
          name,
          slug,
          description,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '创建失败');
      }

      toast.success('团队创建成功');
      resetCreateForm();
      setPage(1);
      await fetchTeams();
      onUpdate();
    } catch (error: any) {
      toast.error(error?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success(data.message || `团队 ${teamName} 已删除`);
      await fetchTeams();
      onUpdate();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
    }
  };

  const handleEditSuccess = async () => {
    await fetchTeams();
    onUpdate();
  };

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    if (checked) {
      setSelectedIds(Array.from(new Set([...selectedIds, ...teams.map((team) => team.id)])));
    } else {
      const pageSet = new Set(teams.map((team) => team.id));
      setSelectedIds(selectedIds.filter((id) => !pageSet.has(id)));
    }
  };

  const toggleTeamSelection = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(Array.from(new Set([...selectedIds, teamId])));
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== teamId));
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择团队');
      return;
    }

    if (!batchServerName.trim() && !batchGuildName.trim() && !batchSlugPrefix.trim()) {
      toast.error('请至少填写一个批量修改项');
      return;
    }

    setBatchLoading(true);
    try {
      const res = await fetch('/api/teams/manage/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamIds: selectedIds,
          serverName: batchServerName.trim() || undefined,
          guildName: batchGuildName.trim() || undefined,
          slugPrefix: batchSlugPrefix.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '批量修改失败');
      }

      toast.success(`已批量修改 ${data.updatedCount || selectedIds.length} 个团队`);
      setSelectedIds([]);
      setBatchServerName('');
      setBatchGuildName('');
      setBatchSlugPrefix('');
      await fetchTeams();
      onUpdate();
    } catch (error: any) {
      toast.error(error?.message || '批量修改失败');
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/50">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-semibold text-gray-100">创建新团队</h3>
          </div>

          <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-200">服务器 *</Label>
              <Input value={serverName} onChange={(e) => setServerName(e.target.value)} className="bg-slate-800/80 border-slate-600 text-gray-200" />
            </div>
            <div>
              <Label className="text-gray-200">工会 *</Label>
              <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} className="bg-slate-800/80 border-slate-600 text-gray-200" />
            </div>
            <div>
              <Label className="text-gray-200">团队名称 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800/80 border-slate-600 text-gray-200" />
            </div>
            <div>
              <Label className="text-gray-200">短链接（可选）</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="bg-slate-800/80 border-slate-600 text-gray-200" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-200">团队描述</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-slate-800/80 border-slate-600 text-gray-200" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                {loading ? '创建中...' : '创建团队'}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-100">团队管理（自动按名称排序）</h3>
            <div className="text-sm text-gray-400">每页 {PAGE_SIZE} 条 · 共 {total} 条</div>
          </div>
          <div className="text-xs text-gray-400">点击团队行中的星标，可设置登录页面默认团队</div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索团队/服务器/工会/短链"
                className="pl-8 bg-slate-900/50 border-slate-600 text-gray-200"
              />
            </div>
            <Select value={filterServer} onValueChange={(value) => { setFilterServer(value); setFilterGuildKey('all'); setPage(1); }}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-gray-200">
                <SelectValue placeholder="服务器" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all">全部服务器</SelectItem>
                {serverOptions.map((option) => (
                  <SelectItem key={option.serverName} value={option.serverName}>{option.serverName} ({option.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterGuildKey} onValueChange={(value) => { setFilterGuildKey(value); setPage(1); }}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-gray-200">
                <SelectValue placeholder="工会" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all">全部工会</SelectItem>
                {filteredGuildOptions.map((option) => (
                  <SelectItem key={guildKey(option.serverName, option.guildName)} value={guildKey(option.serverName, option.guildName)}>
                    {option.serverName} / {option.guildName} ({option.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIds.length > 0 && (
            <div className="rounded border border-amber-700/60 bg-amber-950/20 p-3 space-y-2">
              <div className="text-sm text-amber-200">已选中 {selectedIds.length} 个团队，可批量修改</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  value={batchServerName}
                  onChange={(e) => setBatchServerName(e.target.value)}
                  placeholder="批量改服务器（可选）"
                  className="bg-slate-900/50 border-slate-600 text-gray-200"
                />
                <Input
                  value={batchGuildName}
                  onChange={(e) => setBatchGuildName(e.target.value)}
                  placeholder="批量改工会（可选）"
                  className="bg-slate-900/50 border-slate-600 text-gray-200"
                />
                <Input
                  value={batchSlugPrefix}
                  onChange={(e) => setBatchSlugPrefix(e.target.value)}
                  placeholder="批量改短链前缀（可选）"
                  className="bg-slate-900/50 border-slate-600 text-gray-200"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleBatchUpdate} disabled={batchLoading}>
                  {batchLoading ? '批量修改中...' : '执行批量修改'}
                </Button>
              </div>
            </div>
          )}

          {fetchLoading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无团队</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Checkbox
                  checked={currentPageAllSelected}
                  onCheckedChange={(value) => toggleSelectAllCurrentPage(value === true)}
                />
                选择当前页全部
              </div>

              <div className="rounded border border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-900/70 px-3 py-2 text-xs text-gray-400">
                  <div className="col-span-1">选择</div>
                  <div className="col-span-3">团队名称</div>
                  <div className="col-span-3">服务器 / 工会</div>
                  <div className="col-span-2">短链</div>
                  <div className="col-span-1">人数</div>
                  <div className="col-span-2 text-right">操作</div>
                </div>

                {teams.map((team) => (
                  <div key={team.id} className="grid grid-cols-12 items-center px-3 py-2 border-t border-slate-800 text-sm">
                    <div className="col-span-1">
                      <Checkbox
                        checked={selectedSet.has(team.id)}
                        onCheckedChange={(value) => toggleTeamSelection(team.id, value === true)}
                      />
                    </div>
                    <div className="col-span-3 text-gray-100 truncate" title={team.name}>{team.name}</div>
                    <div className="col-span-3 text-gray-300 truncate" title={`${team.serverName} / ${team.guildName}`}>
                      {team.serverName} / {team.guildName}
                    </div>
                    <div className="col-span-2 text-gray-300 truncate">{team.slug || '(无)'}</div>
                    <div className="col-span-1 text-gray-300">{team._count?.players || 0}</div>
                    <div className="col-span-2 flex justify-end gap-1">
                      <Button
                        variant={defaultLoginTeamId === team.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleSetDefaultLoginTeam(team.id)}
                        disabled={savingDefaultTeamId === team.id}
                        title={defaultLoginTeamId === team.id ? '当前登录默认团队' : '设为登录默认团队'}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingTeam(team)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-800 border-red-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-gray-100">确认删除团队？</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                              将删除团队 <strong className="text-red-400">{team.name}</strong> 及其全部数据，无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTeam(team.id, team.name)}>
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  上一页
                </Button>
                <div className="text-sm text-gray-300">第 {page} / {totalPages} 页</div>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {editingTeam && (
        <TeamEditDialog
          team={editingTeam}
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
