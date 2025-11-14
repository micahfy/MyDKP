'use client';

import { useCallback, useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DkpLog, Team } from '@/types';
import { formatDate } from '@/lib/utils';

interface ManageLog extends DkpLog {
  team?: {
    name: string;
  };
}

interface DkpLogManagerProps {
  teams: Team[];
}

const PAGE_SIZE = 25;

export function DkpLogManager({ teams }: DkpLogManagerProps) {
  const [logs, setLogs] = useState<ManageLog[]>([]);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectableCount = logs.filter((log) => !log.isDeleted).length;

  const fetchLogs = useCallback(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: PAGE_SIZE.toString(),
          includeDeleted: String(includeDeleted),
        });
        if (teamFilter !== 'all') {
          params.set('teamId', teamFilter);
        }
        if (search.trim()) {
          params.set('search', search.trim());
        }
        const res = await fetch(`/api/dkp/logs/manage?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error || '获取记录失败');
          setLogs([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        console.error(error);
        toast.error('获取记录失败');
      } finally {
        setLoading(false);
        setSelectedIds(new Set());
      }
  }, [page, search, teamFilter, includeDeleted]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableCount) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.filter((log) => !log.isDeleted).map((log) => log.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/dkp/logs/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || '删除失败');
        return;
      }
      toast.success(`已删除 ${data.deleted || selectedIds.size} 条记录`);
      setConfirmOpen(false);
      fetchLogs();
    } catch (error) {
      console.error(error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="搜索玩家/原因/操作人..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={teamFilter}
          onValueChange={(value) => {
            setPage(1);
            setTeamFilter(value);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择团队" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部团队</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center space-x-2 text-sm text-gray-400">
          <Checkbox
            checked={includeDeleted}
            onCheckedChange={(checked) => {
              setPage(1);
              setIncludeDeleted(Boolean(checked));
            }}
          />
          <span>显示已删除记录</span>
        </label>
        <Button variant="outline" onClick={() => fetchLogs()} disabled={loading}>
          刷新
        </Button>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={selectedIds.size === 0}
            >
              删除选中
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除选中记录？</AlertDialogTitle>
              <AlertDialogDescription>
                将删除 {selectedIds.size} 条日志，并同步回滚玩家的 DKP。此操作会留下删除留下的痕迹，且无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? '删除中...' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectableCount > 0 && selectedIds.size === selectableCount}
                  disabled={selectableCount === 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>时间</TableHead>
              <TableHead>玩家</TableHead>
              <TableHead>团队</TableHead>
              <TableHead className="text-right">变动</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-400">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className={log.isDeleted ? 'opacity-70' : undefined}>
                  <TableCell>
                    <Checkbox
                      disabled={log.isDeleted}
                      checked={selectedIds.has(log.id)}
                      onCheckedChange={() => toggleSelect(log.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-gray-400">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>{log.player?.name || '-'}</TableCell>
                  <TableCell>{log.team?.name || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={log.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {log.change >= 0 ? '+' : ''}
                      {log.change.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>{log.type}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {log.reason || log.item || log.boss || '-'}
                  </TableCell>
                  <TableCell>{log.operator}</TableCell>
                  <TableCell>
                    {log.isDeleted ? (
                      <div className="flex flex-col text-sm">
                        <Badge variant="destructive" className="w-fit">已删除</Badge>
                        <span className="text-xs text-gray-400">
                          {log.deletedByAdmin?.username || '管理员'}
                          {log.deletedAt ? ` · ${formatDate(log.deletedAt)}` : ''}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="w-fit">有效</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

  <div className="flex items-center justify-between text-sm text-gray-400">
        <div>
          第 {page} / {totalPages} 页，合计 {total} 条
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
