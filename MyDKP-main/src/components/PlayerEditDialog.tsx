'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  '战士', '圣骑士', '猎人', '盗贼', '牧师',
  '萨满祭司', '法师', '术士', '德鲁伊'
];

const UNASSIGNED_TALENT = '__unassigned__';

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

  useEffect(() => {
    if (open) {
      setName(player.name);
      setClassName(player.class);
      setTalent(player.talent ?? UNASSIGNED_TALENT);
      setAttendance((player.attendance * 100).toFixed(0));
      setIsArchived(Boolean(player.isArchived));
    }
  }, [open, player]);

  useEffect(() => {
    const options = getTalentsForClass(className);
    if (talent !== UNASSIGNED_TALENT && !options.includes(talent)) {
      setTalent(UNASSIGNED_TALENT);
    }
  }, [className, talent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('请输入玩家名称');
      return;
    }

    const attendanceValue = parseFloat(attendance) / 100;
    if (isNaN(attendanceValue) || attendanceValue < 0 || attendanceValue > 1) {
      toast.error('出席率必须在 0-100 之间');
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
        toast.success('玩家信息更新成功！');
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
            <Label htmlFor="attendance">出席率 (%)</Label>
            <Input
              id="attendance"
              type="number"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder="0-100"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              当前 DKP 数据不会被修改
            </p>
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
      </DialogContent>
    </Dialog>
  );
}
