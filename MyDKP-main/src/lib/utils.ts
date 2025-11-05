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
  text: string;
  textLight: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  '战士': {
    text: 'text-yellow-600',      // 战士应该是棕黄色/土黄色
    textLight: 'text-yellow-700',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-700',
    glow: 'shadow-yellow-500/50',
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
    text: 'text-yellow-300',     // 盗贼是亮黄色
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
  
  console.log('职业名称匹配:', cleanClassName, '类型:', type);
  
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
  console.warn('未找到职业颜色配置:', cleanClassName);
  if (type === 'hex') {
    return '#9ca3af';
  }
  return type === 'text' ? 'text-gray-400' : 
         type === 'textLight' ? 'text-gray-600' :
         type === 'bg' ? 'bg-gray-700/20' :
         type === 'border' ? 'border-gray-500' :
         'shadow-gray-500/50';
}