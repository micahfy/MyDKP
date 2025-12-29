import { prisma } from '@/lib/prisma';

export const DEFAULT_FAULT_KEYWORDS = [
  '犯错',
  '失误',
  '灭团',
  '开怪',
  '镣铐',
  '下跪',
  '国王愤怒',
  '国王之怒',
  '黑水',
  '扣分',
];

export async function ensureFaultKeywords() {
  const existing = await prisma.faultKeyword.findMany({
    orderBy: { name: 'asc' },
  });

  if (existing.length > 0) {
    return existing;
  }

  await prisma.faultKeyword.createMany({
    data: DEFAULT_FAULT_KEYWORDS.map((name) => ({ name })),
  });

  return prisma.faultKeyword.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function fetchFaultKeywordNames() {
  const keywords = await ensureFaultKeywords();
  return keywords.map((item) => item.name);
}
