import { CategoryPage } from '@/components/hub/category-page';

export const revalidate = 60;

export const metadata = { title: 'Music & DJ' };

export default function Page() {
  return <CategoryPage id="music" />;
}
