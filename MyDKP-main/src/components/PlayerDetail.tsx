'use client';

import { useState, useEffect, ReactNode } from 'react';
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
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface PlayerDetailProps {
  player: Player;
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earn: { label: '获得', color: 'bg-green-500' },
  spend: { label: '消耗', color: 'bg-red-500' },
  decay: { label: '衰减', color: 'bg-orange-500' },
  undo: { label: '撤销', color: 'bg-blue-500' },
  penalty: { label: '扣分', color: 'bg-purple-500' },
  attendance: { label: '出席', color: 'bg-cyan-500' },
};

const EQUIP_REGEX = /\[([^\]]+)\]/g;

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
      <span key={`equip-${key++}`} className="text-purple-400 font-semibold">
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

  useEffect(() => {
    if (open && player) {
      fetchLogs();
    }
  }, [open, player]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dkp/logs?playerId=${player.id}`);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      toast.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {player.name} - {player.class}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">当前DKP</div>
            <div className="text-2xl font-bold text-blue-600">
              {player.currentDkp.toFixed(1)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">总获得</div>
            <div className="text-2xl font-bold text-green-600">
              {player.totalEarned.toFixed(1)}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">总消耗</div>
            <div className="text-2xl font-bold text-red-600">
              {player.totalSpent.toFixed(1)}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">出席率</div>
            <div className="text-2xl font-bold text-purple-600">
              {(player.attendance * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">DKP 变动记录</h3>
          {loading ? (
            <div className="text-center py-10 text-gray-500">加载中...</div>
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
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            TYPE_LABELS[log.type]?.color || 'bg-gray-500'
                          }
                        >
                          {TYPE_LABELS[log.type]?.label || log.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            log.change > 0
                              ? 'text-green-600 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {log.change > 0 ? '+' : ''}
                          {log.change.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.item && (
                          <span className="text-purple-600">[装备] {log.item}</span>
                        )}
                        {log.boss && (
                          <span className="text-orange-600">[Boss] {log.boss}</span>
                        )}
                        {log.reason && !log.item && !log.boss && (
                          <span className="text-gray-600">{renderReasonText(log.reason)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {log.operator}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
