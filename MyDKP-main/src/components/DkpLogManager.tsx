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

export function DkpLogManager({ teams, onChange }: { teams: Team[]; onChange?: () => void }) {
  const [logs, setLogs] = useState<ManageLog[]>([]);
  const [events, setEvents] = useState<DkpEventLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
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
  const [pageInput, setPageInput] = useState('');

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
        includeDeleted: String(includeDeleted),
        view: viewMode,
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
  }, [page, search, teamFilter, includeDeleted, viewMode]);

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
                  {log.type === 'earn' ? '加分' : log.type === 'spend' ? '扣分' : log.type}
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
                        {event.type === 'earn' ? '加分' : event.type === 'spend' ? '扣分' : event.type}
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
        <label className="flex items-center space-x-2 text-sm text-gray-400">
          <Checkbox
            checked={includeDeleted}
            onCheckedChange={(checked) => {
              setIncludeDeleted(Boolean(checked));
              setPage(1);
            }}
          />
          <span>显示已删除记录</span>
        </label>
        <div className="flex items-center gap-2 ml-auto">
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

      <div className="flex items-center justify-between text-sm text-gray-400">
        <div>
          共 {total} {viewMode === 'events' ? '个事件' : '条记录'} · 第 {page}/{totalPages} 页
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
