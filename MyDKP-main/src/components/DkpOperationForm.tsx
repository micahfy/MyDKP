'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [preview, setPreview] = useState<{ classAverage: string; before: string; delta: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const selectedPlayerObj = useMemo(
    () => players.find((p) => p.id === selectedPlayer) || null,
    [players, selectedPlayer],
  );

  useEffect(() => {
    if (operationType === 'makeup-auto' && selectedPlayerObj) {
      fetchPreview();
    } else {
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationType, selectedPlayer]);

  const handleAdjustToClassAverage = async () => {
    if (!selectedPlayerObj) {
      toast.error('请先选择玩家');
      return;
    }
    if (!preview) {
      toast.error('正在获取职业均分，请稍后重试');
      return;
    }
    const confirm = window.confirm(
      `确认将 ${selectedPlayerObj.name} 补至职业均分？\n职业均分：${preview.classAverage}\n当前：${preview.before}\n补分：${preview.delta}`,
    );
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch('/api/dkp/adjust-to-class-average', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayerObj.id,
          teamId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '补分失败');
      } else if (data.noChange) {
        toast.success(`已记录：当前高于均分，无DKP变动。均分${data.classAverage}，当前${data.before}`);
        onSuccess();
        fetchPlayers();
      } else {
        toast.success(`补分完成：职业均分${data.classAverage}，补分前${data.before}，补分${data.delta}`);
        onSuccess();
        fetchPlayers();
      }
    } catch (error) {
      toast.error('补分失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    if (!selectedPlayerObj) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/dkp/adjust-to-class-average', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayerObj.id,
          teamId,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreview(null);
        toast.error(data.error || '获取职业均分失败');
      } else {
        setPreview({
          classAverage: data.classAverage,
          before: data.before,
          delta: data.delta,
        });
      }
    } catch (error) {
      setPreview(null);
      toast.error('获取职业均分失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) {
      toast.error('请选择玩家');
      return;
    }

    if (operationType === 'makeup-auto') {
      await handleAdjustToClassAverage();
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
        toast.success('DKP变动记录成功');
        setSelectedPlayer('');
        setChange('');
        setReason('');
        setItem('');
        setBoss('');
        onSuccess();
        fetchPlayers();
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
              <SelectItem value="earn">加分</SelectItem>
              <SelectItem value="makeup">补分</SelectItem>
              <SelectItem value="makeup-auto">补至职业平均</SelectItem>
              <SelectItem value="spend">支出（装备）</SelectItem>
              <SelectItem value="penalty">扣分</SelectItem>
              <SelectItem value="attendance">出勤奖励</SelectItem>
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
          placeholder={operationType === 'makeup-auto' ? '补至均分将自动计算' : '输入变动数值'}
          required={operationType !== 'makeup-auto'}
          disabled={operationType === 'makeup-auto'}
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

      {operationType === 'makeup-auto' && (
        <div className="rounded-md border border-amber-700/50 bg-amber-900/20 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-amber-100">
              服务器实时计算职业均分（自动忽略最近 6 天补分），无需手工输入数值。
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-amber-500 text-amber-200 hover:bg-amber-800/50"
              onClick={fetchPreview}
              disabled={previewLoading || !selectedPlayerObj}
            >
              {previewLoading ? '计算中...' : '重新计算均分'}
            </Button>
          </div>
          {selectedPlayerObj && preview && (
            <div className="text-sm text-amber-100">
              职业：<span className="font-semibold">{selectedPlayerObj.class}</span> · 均分：
              <span className="font-semibold">{preview.classAverage}</span> · 当前：
              <span className="font-semibold">{preview.before}</span> · 补分：
              <span className="font-semibold text-amber-300">
                {Number(preview.delta) > 0 ? '+' : ''}
                {preview.delta}
              </span>
              {Number(preview.delta) < 0 && (
                <span className="text-xs text-amber-200 ml-2">当前高于均分，将仅记录不变更DKP</span>
              )}
            </div>
          )}
          {!preview && selectedPlayerObj && (
            <div className="text-sm text-amber-200">均分计算中，稍后提交前可点击“重新计算均分”。</div>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '提交中...' : '提交变动'}
      </Button>
    </form>
  );
}
