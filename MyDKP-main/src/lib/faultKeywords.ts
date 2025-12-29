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

export async function ensureGlobalFaultKeywords() {
  const existing = await prisma.faultKeyword.findMany({
    where: { scope: 'global' },
    orderBy: { name: 'asc' },
  });

  if (existing.length > 0) {
    return existing;
  }

  await prisma.faultKeyword.createMany({
    data: DEFAULT_FAULT_KEYWORDS.map((name) => ({ name, scope: 'global' })),
  });

  return prisma.faultKeyword.findMany({
    where: { scope: 'global' },
    orderBy: { name: 'asc' },
  });
}

export async function fetchFaultKeywordNames(teamId: string) {
  const globalKeywords = await ensureGlobalFaultKeywords();
  const teamKeywords = await prisma.faultKeyword.findMany({
    where: { scope: 'team', teamId },
    orderBy: { name: 'asc' },
  });

  const unique = new Set([
    ...globalKeywords.map((item) => item.name),
    ...teamKeywords.map((item) => item.name),
  ]);

  return Array.from(unique);
}
