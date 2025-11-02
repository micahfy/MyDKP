'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RotateCcw } from 'lucide-react';
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
  onSuccess: () => void;
}

export function DecayDialog({ teamId, onSuccess }: DecayDialogProps) {
  const [decayRate, setDecayRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);

  const handleDecay = async () => {
    const rate = parseFloat(decayRate);
    if (isNaN(rate) || rate <= 0 || rate >= 1) {
      toast.error('请输入有效的衰减比例（0-1之间）');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/dkp/decay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, rate }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`衰减执行成功！影响 ${data.affected} 名玩家`);
        setDecayRate('');
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

  const handleUndoDecay = async () => {
    setUndoLoading(true);
    try {
      const res = await fetch('/api/dkp/undo-decay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('撤销衰减成功！');
        onSuccess();
      } else {
        toast.error(data.error || '撤销失败');
      }
    } catch (error) {
      toast.error('撤销失败，请重试');
    } finally {
      setUndoLoading(false);
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
            <Label>衰减比例</Label>
            <Input
              type="number"
              value={decayRate}
              onChange={(e) => setDecayRate(e.target.value)}
              placeholder="输入衰减比例（例如: 0.1 表示衰减10%）"
              step="0.01"
              min="0"
              max="1"
            />
            <p className="text-sm text-gray-500 mt-2">
              {decayRate &&
                !isNaN(parseFloat(decayRate)) &&
                `将对所有玩家执行 ${(parseFloat(decayRate) * 100).toFixed(1)}% 的衰减`}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-2">⚠️ 注意事项：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>衰减将应用于当前团队的所有玩家</li>
                  <li>每个玩家的当前DKP将减少对应比例</li>
                  <li>操作会记录到日志中</li>
                  <li>可通过"撤销上次衰减"恢复</li>
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
                  {decayRate && (parseFloat(decayRate) * 100).toFixed(1)}%
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

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">撤销上次衰减</h3>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">撤销说明：</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>将恢复最近一次衰减前的DKP状态</li>
                <li>只能撤销最近一次衰减操作</li>
                <li>撤销操作会记录到日志</li>
                <li>已撤销的衰减无法再次撤销</li>
              </ul>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full"
                variant="outline"
                disabled={undoLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {undoLoading ? '撤销中...' : '撤销上次衰减'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认撤销衰减？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将恢复最近一次衰减前的DKP状态，所有玩家的DKP将回退到衰减前的数值。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoDecay}>
                  确认撤销
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}