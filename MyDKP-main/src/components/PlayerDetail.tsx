'use client';

import { useEffect, useMemo, useState, ReactNode, Fragment } from 'react';
import { Player, DkpLog } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface PlayerDetailProps {
  player: Player;
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earn: { label: '加分', color: 'bg-green-500' },
  spend: { label: '扣分', color: 'bg-red-500' },
  decay: { label: '衰减', color: 'bg-orange-500' },
  undo: { label: '撤销', color: 'bg-blue-500' },
  penalty: { label: '惩罚', color: 'bg-purple-500' },
  attendance: { label: '出勤', color: 'bg-cyan-500' },
};

const TYPE_TEXT_COLOR: Record<string, string> = {
  earn: 'text-green-600',
  spend: 'text-red-600',
  decay: 'text-orange-600',
  undo: 'text-blue-600',
  penalty: 'text-purple-600',
  attendance: 'text-cyan-600',
};

const EQUIP_REGEX = /\[([^\]]+)\]/g;

function formatDkp(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function renderReasonText(reason: string): ReactNode[] {
  EQUIP_REGEX.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = EQUIP_REGEX.exec(reason)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(reason.slice(lastIndex, match.index));
    }

    nodes.push(
      <span
        key={`equip-${key++}`}
        className="font-semibold"
        style={{ color: '#a335ee' }}
      >
        [{match[1]}]
      </span>,
    );

    lastIndex = EQUIP_REGEX.lastIndex;
  }

  if (lastIndex < reason.length) {
    nodes.push(reason.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [reason];
}

export function PlayerDetail({ player, open, onClose }: PlayerDetailProps) {
  const [logs, setLogs] = useState<DkpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && player) {
      setErrorMessage(null);
      fetchLogs();
      setExpandedDates(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player?.id]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dkp/logs?playerId=${player.id}`);
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || '获取日志失败';
        setErrorMessage(message);
        setLogs([]);
        if (res.status !== 403) {
          toast.error(message);
        }
        return;
      }

      if (Array.isArray(data)) {
        setLogs(data);
        return;
      }
      if (Array.isArray(data?.logs)) {
        setLogs(data.logs);
        return;
      }

      setLogs([]);
      setErrorMessage('日志数据格式异常');
      toast.error('日志数据格式异常');
    } catch (error) {
      console.error(error);
      toast.error('获取日志失败');
      setErrorMessage('获取日志失败');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const groupedRows = useMemo(() => {
    type Row =
      | { kind: 'group'; dateKey: string; total: number; items: DkpLog[] }
      | { kind: 'single'; log: DkpLog };

    const rows: Row[] = [];
    const groupMap = new Map<string, { kind: 'group'; dateKey: string; total: number; items: DkpLog[] }>();

    logs.forEach((log) => {
      const dateKey = new Date(log.createdAt).toISOString().slice(0, 10);
      const isGain =
        log.change > 0 && log.type !== 'decay' && log.type !== 'spend' && !log.isDeleted;

      if (isGain) {
        let group = groupMap.get(dateKey);
        if (!group) {
          group = { kind: 'group', dateKey, total: 0, items: [] };
          groupMap.set(dateKey, group);
          rows.push(group);
        }
        group.total += log.change;
        group.items.push(log);
      } else {
        rows.push({ kind: 'single', log });
      }
    });

    return rows;
  }, [logs]);

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {player.name} - {player.class}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">当前 DKP</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatDkp(player.currentDkp)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">累计获得</div>
            <div className="text-2xl font-bold text-green-600">
              {formatDkp(player.totalEarned)}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">累计支出</div>
            <div className="text-2xl font-bold text-red-600">
              {formatDkp(player.totalSpent)}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">出勤率</div>
            <div className="text-2xl font-bold text-purple-600">
              {(player.attendance * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">累计衰减</div>
            <div className="text-2xl font-bold text-orange-600">
              {formatDkp(player.totalDecay)}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">DKP 变动记录</h3>
          {loading ? (
            <div className="text-center py-10 text-gray-500">加载中...</div>
          ) : errorMessage ? (
            <div className="text-center py-10 text-gray-500">{errorMessage}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">暂无记录</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>变动</TableHead>
                    <TableHead>原因/装备/Boss</TableHead>
                    <TableHead>操作人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRows.map((row) =>
                    row.kind === 'group' ? (
                      <Fragment key={`group-${row.dateKey}`}>
                        <TableRow>
                          <TableCell className="text-sm font-semibold">
                            {row.dateKey}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-600">加分汇总</Badge>
                          </TableCell>
                          <TableCell className="text-green-600 font-semibold">
                            +{formatDkp(row.total)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDateExpand(row.dateKey)}
                              className="text-blue-600"
                          >
                            {expandedDates.has(row.dateKey) ? '收起明细' : '展开明细'}（{row.items.length} 条）
                          </Button>
                        </TableCell>
                          <TableCell />
                        </TableRow>
                        {expandedDates.has(row.dateKey) &&
                          row.items.map((log) => (
                            <TableRow
                              key={log.id}
                              className={log.isDeleted ? 'opacity-70' : undefined}
                            >
                              <TableCell className="text-sm">
                                {formatDate(log.createdAt)}
                              </TableCell>
                              <TableCell>
                                <Badge className={TYPE_LABELS[log.type]?.color || 'bg-gray-500'}>
                                  {TYPE_LABELS[log.type]?.label || log.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-green-600 font-semibold">
                                +{formatDkp(log.change)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {log.item && <span className="text-purple-600">[装备] {log.item}</span>}
                                  {log.boss && <span className="text-orange-600">[Boss] {log.boss}</span>}
                                  {log.reason && (
                                    <span className={TYPE_TEXT_COLOR[log.type] || 'text-gray-600'}>
                                      {renderReasonText(log.reason)}
                                    </span>
                                  )}
                                  {log.isDeleted && (
                                    <span className="text-sm text-red-500">
                                      已由 {log.deletedByAdmin?.username || '管理员'} 在{' '}
                                      {log.deletedAt ? formatDate(log.deletedAt) : '未知时间'} 删除
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">{log.operator}</TableCell>
                            </TableRow>
                          ))}
                      </Fragment>
                    ) : (
                      <TableRow
                        key={row.log.id}
                        className={row.log.isDeleted ? 'opacity-70' : undefined}
                      >
                        <TableCell className="text-sm">{formatDate(row.log.createdAt)}</TableCell>
                        <TableCell>
                          <Badge className={TYPE_LABELS[row.log.type]?.color || 'bg-gray-500'}>
                            {TYPE_LABELS[row.log.type]?.label || row.log.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              row.log.change > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                            }
                          >
                            {row.log.change > 0 ? '+' : ''}
                            {formatDkp(row.log.change)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {row.log.item && <span className="text-purple-600">[装备] {row.log.item}</span>}
                            {row.log.boss && <span className="text-orange-600">[Boss] {row.log.boss}</span>}
                            {row.log.reason && (
                              <span className={TYPE_TEXT_COLOR[row.log.type] || 'text-gray-600'}>
                                {renderReasonText(row.log.reason)}
                              </span>
                            )}
                            {row.log.isDeleted && (
                              <span className="text-sm text-red-500">
                                已由 {row.log.deletedByAdmin?.username || '管理员'} 在{' '}
                                {row.log.deletedAt ? formatDate(row.log.deletedAt) : '未知时间'} 删除
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{row.log.operator}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
