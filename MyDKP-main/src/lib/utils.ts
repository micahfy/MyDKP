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

// 魔兽世界职业颜色配置（使用深色背景友好的颜色）
export const CLASS_COLORS: Record<string, {
  text: string;        // 文字颜色（深色背景）
  textLight: string;   // 文字颜色（浅色背景）
  bg: string;          // 背景颜色
  border: string;      // 边框颜色
  glow: string;        // 发光效果
}> = {
  '战士': {
    text: 'text-amber-400',
    textLight: 'text-amber-700',
    bg: 'bg-amber-900/20',
    border: 'border-amber-700',
    glow: 'shadow-amber-500/50',
  },
  '圣骑士': {
    text: 'text-pink-400',
    textLight: 'text-pink-600',
    bg: 'bg-pink-900/20',
    border: 'border-pink-600',
    glow: 'shadow-pink-500/50',
  },
  '猎人': {
    text: 'text-green-400',
    textLight: 'text-green-600',
    bg: 'bg-green-900/20',
    border: 'border-green-600',
    glow: 'shadow-green-500/50',
  },
  '盗贼': {
    text: 'text-yellow-400',
    textLight: 'text-yellow-600',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-600',
    glow: 'shadow-yellow-500/50',
  },
  '牧师': {
    text: 'text-gray-100',
    textLight: 'text-gray-700',
    bg: 'bg-gray-700/20',
    border: 'border-gray-400',
    glow: 'shadow-gray-400/50',
  },
  '萨满祭司': {
    text: 'text-blue-400',
    textLight: 'text-blue-600',
    bg: 'bg-blue-900/20',
    border: 'border-blue-600',
    glow: 'shadow-blue-500/50',
  },
  '法师': {
    text: 'text-cyan-400',
    textLight: 'text-cyan-600',
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-600',
    glow: 'shadow-cyan-500/50',
  },
  '术士': {
    text: 'text-purple-400',
    textLight: 'text-purple-600',
    bg: 'bg-purple-900/20',
    border: 'border-purple-600',
    glow: 'shadow-purple-500/50',
  },
  '德鲁伊': {
    text: 'text-orange-400',
    textLight: 'text-orange-600',
    bg: 'bg-orange-900/20',
    border: 'border-orange-600',
    glow: 'shadow-orange-500/50',
  },
};

// 职业简称和英文名映射到标准中文名
const CLASS_NAME_MAP: Record<string, string> = {
  // 中文简称
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
  // 英文名
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

export function getClassColor(className: string, type: 'text' | 'textLight' | 'bg' | 'border' | 'glow' = 'text'): string {
  // 先尝试直接匹配
  if (CLASS_COLORS[className]) {
    return CLASS_COLORS[className][type];
  }
  
  // 尝试通过映射表查找
  const mappedName = CLASS_NAME_MAP[className];
  if (mappedName && CLASS_COLORS[mappedName]) {
    return CLASS_COLORS[mappedName][type];
  }
  
  // 尝试模糊匹配（职业名包含关键字）
  for (const [key, value] of Object.entries(CLASS_COLORS)) {
    if (className.includes(key) || key.includes(className)) {
      return value[type];
    }
  }
  
  // 默认返回灰色
  return type === 'text' ? 'text-gray-400' : 
         type === 'textLight' ? 'text-gray-600' :
         type === 'bg' ? 'bg-gray-700/20' :
         type === 'border' ? 'border-gray-500' :
         'shadow-gray-500/50';
}