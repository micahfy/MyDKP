import { TeamDashboard } from '@/components/TeamDashboard';

export const dynamic = 'force-dynamic';

export default function TeamSlugPage({ params }: { params: { slug: string } }) {
  return <TeamDashboard teamSlug={params.slug} />;
}
