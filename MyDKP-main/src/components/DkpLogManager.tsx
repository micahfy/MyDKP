'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
import { DkpEventLog, DkpLog, Team } from '@/types';
import { formatDate, getClassColor } from '@/lib/utils';

interface ManageLog extends DkpLog {
  team?: {
    name: string;
  };
}

type ViewMode = 'entries' | 'events';

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, string> = {
  earn: '加分',
  makeup: '补分',
  spend: '支出',
  decay: '衰减',
  attendance: '出勤',
  other: '其他',
};

const typeLabel = (type: string) => {
  const key = (type || '').trim().toLowerCase();
  return TYPE_LABELS[key] || type;
};

export function DkpLogManager({ teams, onChange }: { teams: Team[]; onChange?: () => void }) {
  const [logs, setLogs] = useState<ManageLog[]>([]);
  const [events, setEvents] = useState<DkpEventLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'valid' | 'all' | 'deleted'>('valid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectableIds = useMemo(() => {
    if (viewMode === 'events') {
      return events.flatMap((event) =>
        event.players.filter((player) => !player.isDeleted).map((player) => player.id),
      );
    }
    return logs.filter((log) => !log.isDeleted).map((log) => log.id);
  }, [viewMode, events, logs]);

  const selectableCount = selectableIds.length;
  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    const pages: number[] = [];
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        status: statusFilter,
        view: viewMode,
      });
      if (teamFilter !== 'all') {
        params.set('teamId', teamFilter);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      const res = await fetch(`/api/dkp/logs/manage?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || '获取记录失败');
        setLogs([]);
        setEvents([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      if (viewMode === 'events') {
        setEvents(data.events || []);
        setLogs([]);
      } else {
        setLogs(data.logs || []);
        setEvents([]);
      }

      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error(error);
      toast.error('获取记录失败');
    } finally {
      setLoading(false);
      setSelectedIds(new Set());
    }
  }, [page, search, teamFilter, statusFilter, viewMode, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      setSelectedIds(new Set(selectableIds));
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
      fetchData();
      onChange?.();
    } catch (error) {
      console.error(error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectAllInEvent = (eventId: string, checked: boolean) => {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;
    const ids = target.players.filter((p) => !p.isDeleted).map((p) => p.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handlePageJump = () => {
    const target = parseInt(pageInput, 10);
    if (Number.isNaN(target) || target < 1 || target > totalPages) {
      toast.error('请输入有效的页码');
      return;
    }
    setPage(target);
    setPageInput('');
  };

  const buildExportFilename = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
      now.getMinutes(),
    )}${pad(now.getSeconds())}`;
    const teamName = teamFilter === 'all' ? 'all' : teams.find((t) => t.id === teamFilter)?.name || teamFilter;
    const typeName =
      typeFilter === 'all'
        ? 'all'
        : typeFilter === 'earn'
        ? 'earn'
        : typeFilter === 'makeup'
        ? 'makeup'
        : typeFilter === 'spend'
        ? 'spend'
        : typeFilter === 'decay'
        ? 'decay'
        : typeFilter === 'attendance'
        ? 'attendance'
        : 'other';
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-');
    const searchPart = search.trim() ? sanitize(search.trim()) : 'all';
    return `dkp-logs_${viewMode}_${sanitize(teamName)}_${typeName}_${searchPart}_${statusFilter}_${dateStr}.csv`;
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        view: viewMode,
        format: 'csv',
      });
      if (search.trim()) params.set('search', search.trim());
      if (teamFilter !== 'all') params.set('teamId', teamFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/dkp/logs/manage?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '导出失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildExportFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV 导出完成');
    } catch (error) {
      console.error(error);
      toast.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const renderEntryTable = () => (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectableCount > 0 && selectedIds.size === selectableCount}
                onCheckedChange={toggleSelectAll}
                aria-label="全选"
              />
            </TableHead>
            <TableHead>时间</TableHead>
            <TableHead>玩家</TableHead>
            <TableHead>团队</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>分数</TableHead>
            <TableHead>原因</TableHead>
            <TableHead>操作人</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-500">
                暂无记录
              </TableCell>
            </TableRow>
          )}
          {logs.map((log) => (
            <TableRow key={log.id} className={log.isDeleted ? 'opacity-60' : ''}>
              <TableCell>
                {!log.isDeleted && (
                  <Checkbox checked={selectedIds.has(log.id)} onCheckedChange={() => toggleSelect(log.id)} />
                )}
              </TableCell>
              <TableCell>{formatDate(log.createdAt)}</TableCell>
              <TableCell>{log.player?.name || '-'}</TableCell>
              <TableCell>{log.team?.name || '-'}</TableCell>
              <TableCell>
                <Badge variant={log.change >= 0 ? 'default' : 'destructive'}>
                  {typeLabel(log.type)}
                </Badge>
              </TableCell>
              <TableCell className={log.change >= 0 ? 'text-green-500' : 'text-red-400'}>
                {log.change >= 0 ? '+' : ''}
                {log.change.toFixed(2)}
              </TableCell>
              <TableCell>{log.reason || '-'}</TableCell>
              <TableCell>{log.operator}</TableCell>
              <TableCell>
                {log.isDeleted ? (
                  <Badge variant="destructive">已删除</Badge>
                ) : (
                  <Badge variant="secondary">有效</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderEventList = () => (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">操作</TableHead>
            <TableHead>时间</TableHead>
            <TableHead>原因</TableHead>
            <TableHead>团队</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>分数</TableHead>
            <TableHead>玩家数</TableHead>
            <TableHead>全选</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-gray-500">
                暂无事件记录
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => {
              const expanded = expandedEvents.has(event.id);
              const activePlayerList = event.players.filter((p) => !p.isDeleted);
              const activePlayers = activePlayerList.length;
              const totalPlayers = event.players.length;
              const selectable = activePlayerList.map((p) => p.id);
              const allSelected = selectable.length > 0 && selectable.every((id) => selectedIds.has(id));
              const selectedCount = selectable.filter((id) => selectedIds.has(id)).length;
              const inlinePlayers =
                activePlayers > 0 && activePlayers <= 3 ? activePlayerList.slice(0, 3) : [];

              return (
                <Fragment key={event.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleEventExpand(event.id)}>
                        {expanded ? '收起' : '展开'}
                      </Button>
                    </TableCell>
                    <TableCell>{formatDate(event.eventTime)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 max-w-2xl">
                        <span className="truncate">{event.reason || '无原因'}</span>
                        {inlinePlayers.map((player) => (
                          <span
                            key={player.id}
                            className={`font-semibold ${getClassColor(player.playerClass || '')}`}
                          >
                            {player.playerName || '-'}
                          </span>
                        ))}
                        <span className="text-xs text-gray-500">操作人：{event.operator}</span>
                      </div>
                    </TableCell>
                    <TableCell>{event.teamName}</TableCell>
                  <TableCell>
                    <Badge variant={event.change >= 0 ? 'default' : 'destructive'}>
                      {typeLabel(event.type)}
                    </Badge>
                  </TableCell>
                    <TableCell className={event.change >= 0 ? 'text-green-500' : 'text-red-400'}>
                      {event.change >= 0 ? '+' : ''}
                      {event.change.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {activePlayers}/{totalPlayers}
                      {selectedCount > 0 && (
                        <span className="text-xs text-purple-300 ml-2">已选 {selectedCount}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => selectAllInEvent(event.id, Boolean(checked))}
                      />
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="border border-slate-700 rounded-md overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12" />
                                <TableHead>玩家</TableHead>
                                <TableHead>分数</TableHead>
                                <TableHead>原因</TableHead>
                                <TableHead>状态</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {event.players.map((player) => (
                                <TableRow key={player.id} className={player.isDeleted ? 'opacity-60' : ''}>
                                  <TableCell>
                                    {!player.isDeleted && (
                                      <Checkbox
                                        checked={selectedIds.has(player.id)}
                                        onCheckedChange={() => toggleSelect(player.id)}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell>{player.playerName || '-'}</TableCell>
                                  <TableCell className={player.change >= 0 ? 'text-green-500' : 'text-red-400'}>
                                    {player.change >= 0 ? '+' : ''}
                                    {player.change.toFixed(2)}
                                  </TableCell>
                                  <TableCell>{player.reason || event.reason || '-'}</TableCell>
                                  <TableCell>
                                    {player.isDeleted ? (
                                      <Badge variant="destructive">已删除</Badge>
                                    ) : (
                                      <Badge variant="secondary">有效</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="搜索玩家或原因"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="类型筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="earn">加分</SelectItem>
            <SelectItem value="makeup">补分</SelectItem>
            <SelectItem value="spend">支出</SelectItem>
            <SelectItem value="decay">衰减</SelectItem>
            <SelectItem value="attendance">出勤</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
          <Select
            value={teamFilter}
            onValueChange={(value) => {
              setTeamFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
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
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const v = value as 'valid' | 'all' | 'deleted';
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="记录状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="valid">有效（默认）</SelectItem>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="deleted">已删除</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting}
            >
              {exporting ? '导出中...' : '导出 CSV'}
            </Button>
            <div className="rounded-md border border-slate-700 p-1 flex gap-1">
              <Button
                variant={viewMode === 'entries' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                setViewMode('entries');
                setPage(1);
                setExpandedEvents(new Set());
              }}
            >
              逐条记录
            </Button>
            <Button
              variant={viewMode === 'events' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('events');
                setPage(1);
                setExpandedEvents(new Set());
              }}
            >
              合并事件
            </Button>
          </div>
          <Button variant="outline" onClick={() => fetchData()} disabled={loading}>
            刷新
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={selectedIds.size === 0}>
                删除选中
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除选中记录？</AlertDialogTitle>
                <AlertDialogDescription>此操作会回滚选中玩家的 DKP，请谨慎执行。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {viewMode === 'events' ? renderEventList() : renderEntryTable()}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
        <div>
          共 {total} {viewMode === 'events' ? '个事件' : '条记录'} · 第 {page}/{totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <div className="flex items-center gap-1">
            {pageNumbers.map((p) => (
              <Button key={p} size="sm" variant={p === page ? 'default' : 'ghost'} onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
          <div className="flex items-center gap-2 ml-4">
            <span>跳转</span>
            <Input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePageJump();
                }
              }}
              className="w-16 h-8 text-center"
              placeholder="页码"
            />
            <Button size="sm" variant="secondary" onClick={handlePageJump}>
              Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
