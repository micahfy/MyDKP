'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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

interface DecayDialogProps {
  teamId: string;
  teams?: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export function DecayDialog({ teamId, teams = [], onSuccess }: DecayDialogProps) {
  const [decayRate, setDecayRate] = useState('15');
  const [selectedTeamId, setSelectedTeamId] = useState(teamId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedTeamId(teamId || '');
  }, [teamId]);

  const handleDecay = async () => {
    const ratePercent = parseFloat(decayRate);
    if (isNaN(ratePercent) || ratePercent <= 0 || ratePercent >= 100) {
      toast.error('请输入有效的衰减比例（1-99之间的数字，例如 15 表示15%）');
      return;
    }
    if (!selectedTeamId) {
      toast.error('请选择要衰减的团队');
      return;
    }
    const rate = ratePercent / 100;

    setLoading(true);
    try {
      const res = await fetch('/api/dkp/decay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId, rate }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`衰减执行成功！影响 ${data.affected} 名玩家`);
        setDecayRate('15');
        onSuccess();
      } else {
        toast.error(data.error || '衰减失败');
      }
    } catch (error) {
      toast.error('衰减失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold">执行DKP衰减</h3>
          </div>

          <div>
            <Label>选择团队</Label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded-md bg-slate-900/70 border border-slate-700 px-3 py-2 text-gray-100"
            >
              <option value="">请选择团队</option>
              {(teams.length > 0 ? teams : [{ id: teamId, name: '当前团队' }]).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>衰减比例</Label>
            <Input
              type="number"
              value={decayRate}
              onChange={(e) => setDecayRate(e.target.value)}
              placeholder="输入衰减比例（例如: 15 表示衰减15%）"
              step="0.1"
              min="1"
              max="99"
            />
            <p className="text-sm text-gray-500 mt-2">
              {decayRate &&
                !isNaN(parseFloat(decayRate)) &&
                `将对所有玩家执行 ${parseFloat(decayRate).toFixed(1)}% 的衰减`}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-2">⚠️ 注意事项：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>请选择正确的团队，衰减将应用于该团队的所有玩家</li>
                  <li>输入为百分比，例如 15 表示衰减 15%</li>
                  <li>操作会记录到日志中，如需撤销请在日志管理删除衰减记录</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full"
                variant="destructive"
                disabled={loading || !decayRate}
              >
                {loading ? '执行中...' : '确认执行衰减'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认执行衰减？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将对当前团队所有玩家执行{' '}
                  {decayRate && !isNaN(parseFloat(decayRate))
                    ? parseFloat(decayRate).toFixed(1)
                    : 0}
                  %
                  的DKP衰减。此操作可以撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDecay}>
                  确认执行
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}
