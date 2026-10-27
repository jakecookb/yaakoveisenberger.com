import type { Metadata } from 'next';
import { Story, storyMetadata } from '@/components/news/story';

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => storyMetadata('cars', (await params).slug);
export default async function Page({ params }: Props) {
  return <Story topic="cars" slug={(await params).slug} />;
}
