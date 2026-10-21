import { listPublicCampaigns } from '@/lib/fund/data';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';
import { HeroFade } from '@/components/hub/hero-fade';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryGrid } from '@/components/hub/category-grid';

// Cached and refreshed every minute (and instantly when the admin saves) so the "live campaigns"
// badge stays current without making `/` dynamic.
export const revalidate = 60;

export default async function HomePage() {
  const [settings, liveCampaigns] = await Promise.all([loadSettings(), listPublicCampaigns().then((c) => c.length).catch(() => 0)]);
  return (
    <>
      <HeroFade>
        <HubHero tagline={settings.hero.tagline} logoSrc={settings.hero.logoPath ? mediaUrl(settings.hero.logoPath) : undefined} />
      </HeroFade>
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <CategoryGrid cards={resolveCards(settings)} liveCampaigns={liveCampaigns} />
      </section>
    </>
  );
}
