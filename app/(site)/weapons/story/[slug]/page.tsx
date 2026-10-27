import type { Metadata } from 'next';
import { Story, storyMetadata } from '@/components/news/story';

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => storyMetadata('weapons', (await params).slug);
export default async function Page({ params }: Props) {
  return <Story topic="weapons" slug={(await params).slug} />;
}
