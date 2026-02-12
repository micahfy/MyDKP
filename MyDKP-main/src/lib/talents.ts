export const TALENTS_BY_CLASS: Record<string, string[]> = {
  '战士': ['武器', '狂怒', '防护'],
  '圣骑士': ['神圣', '防护', '惩戒'],
  '猎人': ['野兽掌握', '射击', '生存'],
  '盗贼': ['刺杀', '战斗', '敏锐'],
  '牧师': ['戒律', '神圣', '暗影'],
  '萨满祭司': ['元素', '增强', '恢复', '坦-增强'],
  '法师': ['奥术', '火焰', '冰霜'],
  '术士': ['痛苦', '恶魔学识', '毁灭'],
  '德鲁伊': ['平衡', '猫-野性战斗', '熊-野性战斗', '恢复'],
};

export function mapTalentCodeToName(className: string, code?: string | null): string | null {
  if (!code) {
    return null;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedCode = trimmed.toLowerCase();
  const index = normalizedCode.charCodeAt(0) - 97;
  if (index < 0 || index > 25) {
    return null;
  }

  const options = getTalentsForClass(className);
  return options[index] ?? null;
}

export function normalizeTalentName(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getTalentsForClass(className?: string | null): string[] {
  if (!className) {
    return [];
  }
  const trimmed = className.trim();
  return TALENTS_BY_CLASS[trimmed] ?? [];
}

export function isTalentValidForClass(className: string, talent?: string | null): boolean {
  const normalizedTalent = normalizeTalentName(talent);
  if (!normalizedTalent) {
    return true;
  }
  const talents = getTalentsForClass(className);
  return talents.includes(normalizedTalent);
}
