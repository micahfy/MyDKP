import {
  BookOpen,
  Bolt,
  Cat,
  CircleDashed,
  Crosshair,
  Droplet,
  Eye,
  Flame,
  Gavel,
  Ghost,
  Leaf,
  Moon,
  PawPrint,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Sprout,
  Sword,
  Swords,
  Wand,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TALENT_ICON_MAP: Record<string, LucideIcon> = {
  '武器': Sword,
  '狂怒': Flame,
  '防护': Shield,
  '神圣': Sparkles,
  '惩戒': Gavel,
  '野兽掌握': PawPrint,
  '射击': Crosshair,
  '生存': Leaf,
  '刺杀': Skull,
  '战斗': Swords,
  '敏锐': Eye,
  '戒律': BookOpen,
  '暗影': Moon,
  '元素': Zap,
  '增强': Bolt,
  '坦-增强': Shield,
  '恢复': Droplet,
  '奥术': Wand,
  '火焰': Flame,
  '冰霜': Snowflake,
  '痛苦': Skull,
  '恶魔学识': Ghost,
  '毁灭': Flame,
  '平衡': Moon,
  '猫-野性战斗': PawPrint,
  '熊-野性战斗': Shield,
};

interface TalentIconProps {
  talent?: string | null;
  className?: string;
  size?: number;
  title?: string;
}

export function TalentIcon({ talent, className, size = 16, title }: TalentIconProps) {
  const normalizedTalent = typeof talent === 'string' ? talent.trim() : '';
  const Icon = normalizedTalent ? TALENT_ICON_MAP[normalizedTalent] : undefined;
  const label = title || normalizedTalent || '待指派';

  return (
    <span className={cn('inline-flex items-center justify-center', className)} aria-label={label} title={label}>
      {Icon ? (
        <Icon className="h-full w-full" width={size} height={size} />
      ) : (
        <CircleDashed className="h-full w-full" width={size} height={size} />
      )}
    </span>
  );
}
