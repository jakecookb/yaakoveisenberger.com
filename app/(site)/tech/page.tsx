import { CategoryPage } from '@/components/hub/category-page';

export const revalidate = 60;

export const metadata = { title: 'Tech Projects' };

export default function Page() {
  return <CategoryPage id="tech" />;
}
