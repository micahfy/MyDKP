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