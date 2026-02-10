import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LootHistory } from '@/components/LootHistory';

interface PageProps {
  params: {
    teamSlug: string;
  };
}

export default async function LootHistoryPage({ params }: PageProps) {
  const team = await prisma.team.findUnique({
    where: { slug: params.teamSlug },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  if (!team) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <LootHistory
        teamSlug={team.slug!}
        teamId={team.id}
        teamName={team.name}
      />
    </div>
  );
}
