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

  useEffect(() => {
    if (teamId) {
      fetchPlayers();
    }
  }, [teamId]);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`);
      const data = await res.json();
      setPlayers(data);
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '提交中...' : '提交变动'}
      </Button>
    </form>
  );
}
