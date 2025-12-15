'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Player } from '@/types';

interface DkpOperationFormProps {
  teamId: string;
  onSuccess: () => void;
}

export function DkpOperationForm({ teamId, onSuccess }: DkpOperationFormProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [operationType, setOperationType] = useState('earn');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [item, setItem] = useState('');
  const [boss, setBoss] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerKeyword, setPlayerKeyword] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [baselineByClass, setBaselineByClass] = useState<Record<string, number>>({});

  useEffect(() => {
    if (teamId) {
      setBaselineByClass({});
      fetchPlayers();
    }
  }, [teamId]);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`);
      const data = await res.json();
      setPlayers(data);
      if (Object.keys(baselineByClass).length === 0) {
        const map: Record<string, { sum: number; count: number }> = {};
        data.forEach((p: Player) => {
          const cls = p.class || 'unknown';
          if (!map[cls]) map[cls] = { sum: 0, count: 0 };
          map[cls].sum += p.currentDkp;
          map[cls].count += 1;
        });
        const baseline: Record<string, number> = {};
        Object.entries(map).forEach(([cls, v]) => {
          baseline[cls] = Number((v.sum / v.count).toFixed(2));
        });
        setBaselineByClass(baseline);
      }
    } catch (error) {
      toast.error('获取玩家列表失败');
    }
  };

  const effectiveKeyword = isComposing ? '' : playerKeyword.trim().toLowerCase();
  const filteredPlayers = useMemo(
    () =>
      effectiveKeyword
        ? players.filter((p) => p.name.toLowerCase().includes(effectiveKeyword))
        : players,
    [players, effectiveKeyword],
  );

  const selectedPlayerObj = useMemo(
    () => players.find((p) => p.id === selectedPlayer) || null,
    [players, selectedPlayer],
  );

  const classBaseline = selectedPlayerObj ? baselineByClass[selectedPlayerObj.class] : undefined;
  const classDelta =
    selectedPlayerObj && classBaseline !== undefined
      ? Number((classBaseline - selectedPlayerObj.currentDkp).toFixed(2))
      : undefined;

  const handleAdjustToClassAverage = async () => {
    if (!selectedPlayerObj) {
      toast.error('请先选择玩家');
      return;
    }
    if (classBaseline === undefined) {
      toast.error('无法获取该职业的基准平均分');
      return;
    }
    const delta = classDelta ?? 0;
    if (delta === 0) {
      toast.info('该玩家分数已等于职业平均，无需补分');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/dkp/adjust-to-class-average', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayerObj.id,
          teamId,
          classAverage: classBaseline,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '补分失败');
      } else {
        toast.success(
          `补分完成：职业均分 ${classBaseline.toFixed(2)}，当前 ${selectedPlayerObj.currentDkp.toFixed(
            2,
          )}，补分 ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`,
        );
        onSuccess();
      }
    } catch (error) {
      toast.error('补分失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) {
      toast.error('请选择玩家');
      return;
    }

    setLoading(true);
    try {
      const changeValue = parseFloat(change);
      const finalChange =
        operationType === 'spend' || operationType === 'penalty'
          ? -Math.abs(changeValue)
          : Math.abs(changeValue);

      const res = await fetch('/api/dkp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer,
          teamId,
          type: operationType,
          change: finalChange,
          reason: reason || undefined,
          item: item || undefined,
          boss: boss || undefined,
        }),
      });

      if (res.ok) {
        toast.success('DKP变动记录成功！');
        setSelectedPlayer('');
        setChange('');
        setReason('');
        setItem('');
        setBoss('');
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>选择玩家</Label>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger>
              <SelectValue placeholder="选择玩家" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <div className="px-2 py-1">
                <Input
                  value={playerKeyword}
                  onChange={(e) => setPlayerKeyword(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    setPlayerKeyword(e.currentTarget.value);
                  }}
                  placeholder="输入关键字过滤"
                  className="h-8"
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {filteredPlayers.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.name} ({player.class})
                </SelectItem>
              ))}
              {filteredPlayers.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">无匹配玩家</div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>操作类型</Label>
          <Select value={operationType} onValueChange={setOperationType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="earn">获得DKP</SelectItem>
              <SelectItem value="spend">消耗DKP（装备）</SelectItem>
              <SelectItem value="penalty">扣分</SelectItem>
              <SelectItem value="attendance">出席奖励</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>变动数值</Label>
        <Input
          type="number"
          value={change}
          onChange={(e) => setChange(e.target.value)}
          placeholder="输入变动数值"
          required
          step="0.1"
        />
      </div>

      {operationType === 'spend' && (
        <div>
          <Label>装备名称</Label>
          <Input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="例如: 泰坦之握"
          />
        </div>
      )}

      {operationType === 'earn' && (
        <div>
          <Label>Boss名称（可选）</Label>
          <Input
            value={boss}
            onChange={(e) => setBoss(e.target.value)}
            placeholder="例如: 奈法利安"
          />
        </div>
      )}

      <div>
        <Label>备注说明</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="记录操作原因或备注信息"
          rows={3}
        />
      </div>

      {selectedPlayerObj && classBaseline !== undefined && (
        <div className="rounded-md border border-amber-700/50 bg-amber-900/20 p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm text-amber-100">
              职业：<span className="font-semibold">{selectedPlayerObj.class}</span> · 职业平均：
              <span className="font-semibold">{classBaseline.toFixed(2)}</span> · 当前：
              <span className="font-semibold">{selectedPlayerObj.currentDkp.toFixed(2)}</span>
              · 预计补分：
              <span className="font-semibold text-amber-300">
                {classDelta !== undefined && (classDelta > 0 ? '+' : '') + classDelta.toFixed(2)}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-amber-500 text-amber-200 hover:bg-amber-800/50"
              onClick={handleAdjustToClassAverage}
              disabled={loading}
            >
              补至本职业平均
            </Button>
          </div>
          <p className="text-xs text-amber-200">
            职业平均基于本次打开时的快照，多次补分不会互相影响。
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '提交中...' : '提交变动'}
      </Button>
    </form>
  );
}
