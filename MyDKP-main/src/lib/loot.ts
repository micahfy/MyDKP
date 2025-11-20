import { prisma } from '@/lib/prisma';

export interface LootKeyword {
  name: string;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeLootName(name: string) {
  return name.trim().toLowerCase();
}

export async function fetchLootItems(): Promise<LootKeyword[]> {
  const items = await prisma.lootItem.findMany({
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return items;
}

export function normalizeReason(reason: string | null | undefined) {
  if (!reason) return '';
  return reason.replace(/\[|\]/g, '').trim();
}

export function applyLootHighlight(
  reason: string | null | undefined,
  lootItems: LootKeyword[],
) {
  if (!reason) return reason ?? '';
  let result = reason;

  for (const item of lootItems) {
    const pattern = new RegExp(escapeRegExp(item.name), 'gi');
    result = result.replace(pattern, (match, offset, full) => {
      const before = full[offset - 1];
      const after = full[offset + match.length];
      if (before === '[' && after === ']') {
        return match;
      }
      return `[${match}]`;
    });
  }

  return result;
}
