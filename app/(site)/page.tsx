import { listPublicCampaigns } from '@/lib/fund/data';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryGrid } from '@/components/hub/category-grid';

// Cached and refreshed every minute so the "live campaigns" badge stays current without making `/` dynamic.
export const revalidate = 60;

export default async function HomePage() {
  const liveCampaigns = await listPublicCampaigns().then((c) => c.length).catch(() => 0);
  return (
    <>
      <HubHero />
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <CategoryGrid liveCampaigns={liveCampaigns} />
      </section>
    </>
  );
}
