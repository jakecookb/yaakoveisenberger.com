import { listPublicCampaigns } from '@/lib/fund/data';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';
import { HeroFade } from '@/components/hub/hero-fade';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryGrid } from '@/components/hub/category-grid';
import { NewsColumn } from '@/components/hub/news-column';

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
      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 pb-20 sm:px-6 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* A greyed-out box's description is private too: it never reaches the page. */}
          <CategoryGrid cards={resolveCards(settings).map((c) => (c.greyed ? { ...c, teaser: '' } : c))} liveCampaigns={liveCampaigns} />
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start"><NewsColumn /></div>
      </section>
    </>
  );
}
