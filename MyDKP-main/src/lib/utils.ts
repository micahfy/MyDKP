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

export function getClassColor(className: string, type: 'text' | 'textLight' | 'bg' | 'border' | 'glow' = 'text'): string {
  return CLASS_COLORS[className]?.[type] || 'text-gray-400';
}