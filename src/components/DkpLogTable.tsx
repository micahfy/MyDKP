'use client';

import { useState, useEffect } from 'react';
import { DkpLog } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface DkpLogTableProps {
  teamId: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earn: { label: '获得', color: 'bg-green-500' },
  spend: { label: '消耗', color: 'bg-red-500' },
  decay: { label: '衰减', color: 'bg-orange-500' },
  undo: { label: '撤销', color: 'bg-blue-500' },
  penalty: { label: '扣分', color: 'bg-purple-500' },
  attendance: { label: '出席', color: 'bg-cyan-500' },
};

export function DkpLogTable({ teamId }: DkpLogTableProps) {
  const [logs, setLogs] = useState<DkpLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchLogs();
    }
  }, [teamId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dkp/logs?teamId=${teamId}&limit=50`);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      toast.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      'player_name,change,reason,item_or_boss,operator,timestamp',
      ...logs.map((log) => {
        const itemOrBoss = log.item || log.boss || log.reason || '';
        return `${log.player?.name},${log.change},${log.reason || ''},${itemOrBoss},${log.operator},${log.createdAt}`;
      }),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dkp-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('导出成功！');
  };

  if (!teamId) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>最近DKP变动记录</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出日志
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                  <TableHead>玩家</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>变动</TableHead>
                  <TableHead>详情</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {log.player?.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={TYPE_LABELS[log.type]?.color || 'bg-gray-500'}
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
                    <TableCell className="max-w-xs truncate">
                      {log.item && (
                        <span className="text-purple-600">[装备] {log.item}</span>
                      )}
                      {log.boss && (
                        <span className="text-orange-600">[Boss] {log.boss}</span>
                      )}
                      {log.reason && !log.item && !log.boss && (
                        <span className="text-gray-600">{log.reason}</span>
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
      </CardContent>
    </Card>
  );
}