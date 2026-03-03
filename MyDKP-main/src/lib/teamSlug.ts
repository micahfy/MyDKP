import { prisma } from '@/lib/prisma';

const TEAM_SLUG_MAX_LENGTH = 48;

function sanitizeSlug(raw: string) {
  const value = raw
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return value.slice(0, TEAM_SLUG_MAX_LENGTH).replace(/-+$/g, '');
}

export function slugifyTeamName(teamName: string) {
  const base = sanitizeSlug(teamName);
  return base || 'team';
}

export function resolveTeamSlug(team: { id: string; slug?: string | null }) {
  return (team.slug || '').trim() || team.id;
}

export async function generateUniqueSlugFromBase(baseInput: string, excludeTeamId?: string) {
  const base = slugifyTeamName(baseInput);

  for (let index = 0; index < 5000; index++) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const conflict = await prisma.team.findFirst({
      where: {
        slug: candidate,
        ...(excludeTeamId
          ? {
              NOT: {
                id: excludeTeamId,
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (!conflict) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function generateUniqueTeamSlug(teamName: string, excludeTeamId?: string) {
  return generateUniqueSlugFromBase(teamName, excludeTeamId);
}
