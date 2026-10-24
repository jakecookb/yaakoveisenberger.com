import { listPublicCampaigns } from '@/lib/fund/data';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';
import { HeroFade } from '@/components/hub/hero-fade';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryGrid } from '@/components/hub/category-grid';
import { HeavyScroll } from '@/components/site/heavy-scroll';
import { HubSection } from '@/components/hub/hub-section';
import { directoryColumns, groupCards, HUB_SECTIONS as SECTIONS } from '@/lib/site/hub';

// Cached and refreshed every minute (and instantly when the admin saves) so the "live campaigns"
// badge stays current without making `/` dynamic.
export const revalidate = 60;

export default async function HomePage() {
  const [settings, liveCampaigns] = await Promise.all([loadSettings(), listPublicCampaigns().then((c) => c.length).catch(() => 0)]);
  // A greyed-out box's description is private too: it never reaches the page.
  const all = resolveCards(settings).map((c) => (c.greyed ? { ...c, teaser: '' } : c));
  const groups = groupCards(all);
  return (
    <>
      <HeavyScroll />
      <HeroFade>
        <HubHero tagline={settings.hero.tagline} logoSrc={settings.hero.logoPath ? mediaUrl(settings.hero.logoPath) : undefined} />
      </HeroFade>
      <div className="relative z-10 mx-auto max-w-7xl overflow-x-clip space-y-16 px-4 pb-20 sm:px-6 sm:pb-28">
        {SECTIONS.map((sec, i) => {
          const cards = groups[sec.id];
          if (!cards.length) return null;
          const grid = <CategoryGrid cards={cards} liveCampaigns={liveCampaigns} news={sec.id === 'news'} directory={sec.id === 'personal'} />;
          if (sec.id !== 'personal')
            return <HubSection key={sec.id} id={sec.id} title={sec.title} subtitle={sec.subtitle} accent={sec.accent} z={i + 1} first={i === 0}>{grid}</HubSection>;
          // Personal & Boards: one four-column directory on tablet/desktop; on phones each column is its own stacking layer.
          return [
            <HubSection key={sec.id} id={sec.id} title={sec.title} subtitle={sec.subtitle} accent={sec.accent} z={i + 1} first={i === 0} className="max-md:hidden">{grid}</HubSection>,
            ...directoryColumns(cards).map((col, j) => (
              <HubSection key={col.title} id={`${sec.id}-${j}`} title={col.title} subtitle={sec.title} accent={sec.accent} z={i + 1 + j} className="md:hidden">
                <CategoryGrid cards={col.cards} liveCampaigns={liveCampaigns} news />
              </HubSection>
            )),
          ];
        })}
      </div>
    </>
  );
}
