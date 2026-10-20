import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryPage } from '@/components/hub/category-page';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

// Pages for boxes created in the admin editor. Rendered on demand, then cached for a minute (and refreshed when you save).
export const revalidate = 60;

async function find(slug: string) {
  return resolveCards(await loadSettings(), { includeHidden: true }).find((c) => c.id === slug && c.kind === 'page');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = await find((await params).slug);
  return { title: card?.title ?? 'Page', robots: card?.locked ? { index: false } : undefined };
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await find(slug))) notFound();
  return <CategoryPage id={slug} />;
}
