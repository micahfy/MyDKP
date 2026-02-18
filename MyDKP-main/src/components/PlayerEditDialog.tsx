'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Player } from '@/types';
import { getTalentsForClass } from '@/lib/talents';

const WOW_CLASSES = [
  '战士',
  '圣骑士',
  '猎人',
  '盗贼',
  '牧师',
  '萨满祭司',
  '法师',
  '术士',
  '德鲁伊',
];

const UNASSIGNED_TALENT = '__unassigned__';

type InlineDkpType = 'earn' | 'spend';

interface MakeupPreview {
  className: string;
  classAverage: string;
  before: string;
  delta: string;
}

interface PlayerEditDialogProps {
  player: Player;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PlayerEditDialog({ player, open, onOpenChange, onSuccess }: PlayerEditDialogProps) {
  const [name, setName] = useState(player.name);
  const [className, setClassName] = useState(player.class);
  const [talent, setTalent] = useState(player.talent ?? UNASSIGNED_TALENT);
  const [attendance, setAttendance] = useState((player.attendance * 100).toFixed(0));
  const [isArchived, setIsArchived] = useState(Boolean(player.isArchived));
  const [loading, setLoading] = useState(false);

  const [inlineDkpType, setInlineDkpType] = useState<InlineDkpType>('earn');
  const [inlineDkpValue, setInlineDkpValue] = useState('');
  const [inlineDkpReason, setInlineDkpReason] = useState('');
  const [inlineDkpTime, setInlineDkpTime] = useState('');
  const [inlineDkpLoading, setInlineDkpLoading] = useState(false);

  const [makeupPreview, setMakeupPreview] = useState<MakeupPreview | null>(null);
  const [makeupPreviewLoading, setMakeupPreviewLoading] = useState(false);
  const [makeupLoading, setMakeupLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(player.name);
      setClassName(player.class);
      setTalent(player.talent ?? UNASSIGNED_TALENT);
      setAttendance((player.attendance * 100).toFixed(0));
      setIsArchived(Boolean(player.isArchived));

      setInlineDkpType('earn');
      setInlineDkpValue('');
      setInlineDkpReason('');
      setInlineDkpTime('');
      setMakeupPreview(null);
    }
  }, [open, player]);

  useEffect(() => {
    const options = getTalentsForClass(className);
    if (talent !== UNASSIGNED_TALENT && !options.includes(talent)) {
      setTalent(UNASSIGNED_TALENT);
    }
  }, [className, talent]);

  const fetchMakeupPreview = async (): Promise<MakeupPreview | null> => {
    setMakeupPreviewLoading(true);
    try {
      const res = await fetch('/api/dkp/adjust-to-class-average', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          teamId: player.teamId,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || '获取职业均分失败');
        setMakeupPreview(null);
        return null;
      }
      const nextPreview: MakeupPreview = {
        className: data.class ?? player.class,
        classAverage: data.classAverage,
        before: data.before,
        delta: data.delta,
      };
      setMakeupPreview(nextPreview);
      return nextPreview;
    } catch (error) {
      toast.error('获取职业均分失败');
      setMakeupPreview(null);
      return null;
    } finally {
      setMakeupPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('请输入玩家名称');
      return;
    }

    const attendanceValue = parseFloat(attendance) / 100;
    if (isNaN(attendanceValue) || attendanceValue < 0 || attendanceValue > 1) {
      toast.error('出勤率必须在 0-100 之间');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          class: className,
          talent: talent === UNASSIGNED_TALENT ? null : talent,
          attendance: attendanceValue,
          isArchived,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('玩家信息更新成功');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(data.error || '更新失败');
      }
    } catch (error) {
      toast.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleInlineDkpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number(inlineDkpValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('请填写大于 0 的分值');
      return;
    }

    if (!inlineDkpReason.trim()) {
      toast.error('请填写原因');
      return;
    }

    let eventTimeIso: string | undefined;
    if (inlineDkpTime) {
      const parsedTime = new Date(inlineDkpTime);
      if (Number.isNaN(parsedTime.getTime())) {
        toast.error('时间格式不正确');
        return;
      }
      eventTimeIso = parsedTime.toISOString();
    }

    setInlineDkpLoading(true);
    try {
      const change = inlineDkpType === 'spend' ? -Math.abs(amount) : Math.abs(amount);
      const res = await fetch('/api/dkp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          teamId: player.teamId,
          type: inlineDkpType,
          change,
          reason: inlineDkpReason.trim(),
          ...(eventTimeIso ? { eventTime: eventTimeIso } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || 'DKP操作失败');
        return;
      }

      toast.success(inlineDkpType === 'earn' ? '加分成功' : '支出记录成功');
      setInlineDkpValue('');
      setInlineDkpReason('');
      setInlineDkpTime('');
      onSuccess();
      if (makeupPreview) {
        fetchMakeupPreview();
      }
    } catch (error) {
      toast.error('DKP操作失败，请重试');
    } finally {
      setInlineDkpLoading(false);
    }
  };

  const handleAdjustToClassAverage = async () => {
    if (makeupLoading || makeupPreviewLoading) {
      return;
    }

    const preview = (await fetchMakeupPreview()) ?? makeupPreview;
    if (!preview) {
      return;
    }

    const confirmed = window.confirm(
      `确认将 ${player.name} 补至职业平均？\n职业：${preview.className}\n职业均分：${preview.classAverage}\n当前DKP：${preview.before}\n补分：${preview.delta}`,
    );

    if (!confirmed) {
      return;
    }

    setMakeupLoading(true);
    try {
      const res = await fetch('/api/dkp/adjust-to-class-average', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          teamId: player.teamId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || '补分失败');
        return;
      }

      if (data.noChange) {
        toast.success(`当前高于均分，仅记录，无DKP变动。均分${data.classAverage}，当前${data.before}`);
      } else {
        toast.success(`补分完成：职业均分${data.classAverage}，补分前${data.before}，补分${data.delta}`);
      }
      onSuccess();
      fetchMakeupPreview();
    } catch (error) {
      toast.error('补分失败，请重试');
    } finally {
      setMakeupLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit2 className="h-5 w-5" />
            <span>编辑玩家信息</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="playerName">角色名 *</Label>
            <Input
              id="playerName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 无敌战士"
              required
            />
          </div>

          <div>
            <Label htmlFor="playerClass">职业 *</Label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger id="playerClass">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WOW_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="playerTalent">天赋</Label>
            <Select value={talent} onValueChange={setTalent}>
              <SelectTrigger id="playerTalent">
                <SelectValue placeholder="待指派" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_TALENT}>待指派</SelectItem>
                {getTalentsForClass(className).map((talentName) => (
                  <SelectItem key={talentName} value={talentName}>
                    {talentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="attendance">出勤率 (%)</Label>
            <Input
              id="attendance"
              type="number"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder="0-100"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">当前 DKP 数据不会被修改</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="archived"
              type="checkbox"
              checked={isArchived}
              onChange={(e) => setIsArchived(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="archived">封存该玩家（访客不可见，不参与职业均分）</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>

        <div className="border-t border-slate-700 pt-4 space-y-4">
          <div className="text-sm font-medium text-gray-200">玩家DKP操作</div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={inlineDkpType === 'earn' ? 'default' : 'outline'}
              onClick={() => setInlineDkpType('earn')}
              disabled={inlineDkpLoading || makeupLoading}
            >
              加分
            </Button>
            <Button
              type="button"
              variant={inlineDkpType === 'spend' ? 'default' : 'outline'}
              onClick={() => setInlineDkpType('spend')}
              disabled={inlineDkpLoading || makeupLoading}
            >
              支出
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAdjustToClassAverage}
              disabled={inlineDkpLoading || makeupLoading || makeupPreviewLoading}
            >
              {makeupLoading ? '执行中...' : makeupPreviewLoading ? '计算中...' : '补至职业平均'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={fetchMakeupPreview}
              disabled={inlineDkpLoading || makeupLoading || makeupPreviewLoading}
            >
              预览职业均分
            </Button>
          </div>

          {makeupPreview && (
            <div className="rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-100">
              职业：<span className="font-semibold">{makeupPreview.className}</span>
              {' · '}均分：<span className="font-semibold">{makeupPreview.classAverage}</span>
              {' · '}当前：<span className="font-semibold">{makeupPreview.before}</span>
              {' · '}补分：
              <span className="font-semibold text-amber-300">
                {Number(makeupPreview.delta) > 0 ? '+' : ''}
                {makeupPreview.delta}
              </span>
            </div>
          )}

          <form onSubmit={handleInlineDkpSubmit} className="space-y-3">
            <div>
              <Label>{inlineDkpType === 'earn' ? '加分分值 *' : '支出分值 *'}</Label>
              <Input
                type="number"
                value={inlineDkpValue}
                onChange={(e) => setInlineDkpValue(e.target.value)}
                min="0"
                step="0.01"
                placeholder="请输入分值"
                required
              />
            </div>

            <div>
              <Label>原因 *</Label>
              <Textarea
                value={inlineDkpReason}
                onChange={(e) => setInlineDkpReason(e.target.value)}
                rows={2}
                placeholder={inlineDkpType === 'earn' ? '填写加分原因' : '填写支出原因'}
                required
              />
            </div>

            <div>
              <Label>时间（可选）</Label>
              <Input
                type="datetime-local"
                value={inlineDkpTime}
                onChange={(e) => setInlineDkpTime(e.target.value)}
                placeholder="不填写则使用当前时间"
              />
            </div>

            <Button type="submit" className="w-full" disabled={inlineDkpLoading || makeupLoading}>
              {inlineDkpLoading
                ? '提交中...'
                : inlineDkpType === 'earn'
                ? '确认加分'
                : '确认支出'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
