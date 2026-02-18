import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('zh-CN');
}

export function calculateAttendance(
  participationCount: number,
  totalActivities: number
): number {
  if (totalActivities === 0) return 0;
  return Math.round((participationCount / totalActivities) * 100) / 100;
}

// 职业颜色
export const CLASS_COLORS: Record<string, {
  text: string;
  textLight: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  '战士': {
    text: 'text-wow-warrior',
    textLight: 'text-wow-warrior',
    bg: 'bg-wow-warrior/20',
    border: 'border-wow-warrior/50',
    glow: 'shadow-wow-warrior/50',
  },
  '圣骑士': {
    text: 'text-wow-paladin',
    textLight: 'text-wow-paladin',
    bg: 'bg-wow-paladin/20',
    border: 'border-wow-paladin/50',
    glow: 'shadow-wow-paladin/50',
  },
  '猎人': {
    text: 'text-wow-hunter',
    textLight: 'text-wow-hunter',
    bg: 'bg-wow-hunter/20',
    border: 'border-wow-hunter/50',
    glow: 'shadow-wow-hunter/50',
  },
  '盗贼': {
    text: 'text-wow-rogue',
    textLight: 'text-wow-rogue',
    bg: 'bg-wow-rogue/20',
    border: 'border-wow-rogue/50',
    glow: 'shadow-wow-rogue/50',
  },
  '牧师': {
    text: 'text-wow-priest',
    textLight: 'text-wow-priest',
    bg: 'bg-wow-priest/20',
    border: 'border-wow-priest/50',
    glow: 'shadow-wow-priest/50',
  },
  '萨满祭司': {
    text: 'text-wow-shaman',
    textLight: 'text-wow-shaman',
    bg: 'bg-wow-shaman/20',
    border: 'border-wow-shaman/50',
    glow: 'shadow-wow-shaman/50',
  },
  '法师': {
    text: 'text-wow-mage',
    textLight: 'text-wow-mage',
    bg: 'bg-wow-mage/20',
    border: 'border-wow-mage/50',
    glow: 'shadow-wow-mage/50',
  },
  '术士': {
    text: 'text-wow-warlock',
    textLight: 'text-wow-warlock',
    bg: 'bg-wow-warlock/20',
    border: 'border-wow-warlock/50',
    glow: 'shadow-wow-warlock/50',
  },
  '德鲁伊': {
    text: 'text-wow-druid',
    textLight: 'text-wow-druid',
    bg: 'bg-wow-druid/20',
    border: 'border-wow-druid/50',
    glow: 'shadow-wow-druid/50',
  },
};

const CLASS_NAME_MAP: Record<string, string> = {
  '战': '战士',
  '骑': '圣骑士',
  'QS': '圣骑士',
  '猎': '猎人',
  'LR': '猎人',
  '贼': '盗贼',
  'DZ': '盗贼',
  '牧': '牧师',
  'MS': '牧师',
  '萨': '萨满祭司',
  '萨满': '萨满祭司',
  'SM': '萨满祭司',
  '法': '法师',
  'FS': '法师',
  '术': '术士',
  'SS': '术士',
  '德': '德鲁伊',
  'XD': '德鲁伊',
  'Warrior': '战士',
  'Paladin': '圣骑士',
  'Hunter': '猎人',
  'Rogue': '盗贼',
  'Priest': '牧师',
  'Shaman': '萨满祭司',
  'Mage': '法师',
  'Warlock': '术士',
  'Druid': '德鲁伊',
};

const CLASS_HEX: Record<string, string> = {
  '战士': '#ca8a04',      // yellow-600
  '圣骑士': '#f472b6',    // pink-400
  '猎人': '#4ade80',      // green-400
  '盗贼': '#fde047',      // yellow-300
  '牧师': '#e5e7eb',      // gray-100
  '萨满祭司': '#60a5fa',  // blue-400
  '法师': '#67e8f9',      // cyan-400
  '术士': '#c084fc',      // purple-400
  '德鲁伊': '#fb923c',    // orange-400
};

export function getClassColor(className: string, type: 'text' | 'textLight' | 'bg' | 'border' | 'glow' | 'hex' = 'text'): string {
  // 先清理职业名称（去除空格和特殊字符）
  const cleanClassName = className?.trim() || '';
  
  // 直接匹配
  if (CLASS_COLORS[cleanClassName]) {
    if (type === 'hex') {
      return CLASS_HEX[cleanClassName] || '#9ca3af';
    }
    return CLASS_COLORS[cleanClassName][type];
  }
  
  // 通过映射表查找
  const mappedName = CLASS_NAME_MAP[cleanClassName];
  if (mappedName && CLASS_COLORS[mappedName]) {
    if (type === 'hex') {
      return CLASS_HEX[mappedName] || '#9ca3af';
    }
    return CLASS_COLORS[mappedName][type];
  }
  
  // 模糊匹配
  for (const [key, value] of Object.entries(CLASS_COLORS)) {
    if (cleanClassName.includes(key) || key.includes(cleanClassName)) {
      if (type === 'hex') {
        return CLASS_HEX[key] || '#9ca3af';
      }
      return value[type];
    }
  }
  
  // 默认灰色
  if (type === 'hex') {
    return '#9ca3af';
  }
  return type === 'text' ? 'text-gray-400' : 
         type === 'textLight' ? 'text-gray-600' :
         type === 'bg' ? 'bg-gray-700/20' :
         type === 'border' ? 'border-gray-500' :
         'shadow-gray-500/50';
}

const CLASS_SHORT_NAME_MAP: Record<string, string> = {
  '骑': '骑',
  '圣骑士': '骑',
  '猎': '猎',
  '猎人': '猎',
  '贼': '贼',
  '盗贼': '贼',
  '潜行者': '贼',
  '萨': '萨',
  '萨满祭司': '萨',
  '法': '法',
  '法师': '法',
  '牧': '牧',
  '牧师': '牧',
  '德': '德',
  '德鲁伊': '德',
  '小德': '德',
  '战': '战',
  '战士': '战',
  '术': '术',
  '术士': '术',
};

export function getClassShortName(className: string): string {
  const cleanClassName = className?.trim() || '';
  if (!cleanClassName) return '';

  const direct = CLASS_SHORT_NAME_MAP[cleanClassName];
  if (direct) return direct;

  const mappedName = CLASS_NAME_MAP[cleanClassName];
  if (mappedName && CLASS_SHORT_NAME_MAP[mappedName]) {
    return CLASS_SHORT_NAME_MAP[mappedName];
  }

  for (const [alias, shortName] of Object.entries(CLASS_SHORT_NAME_MAP)) {
    if (cleanClassName.includes(alias)) {
      return shortName;
    }
  }

  return cleanClassName[0];
}
