import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function TeamLegacySlugPage({ params }: { params: { slug: string } }) {
  redirect(`/${encodeURIComponent(params.slug)}`);
}
