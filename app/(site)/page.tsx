import { listPublicCampaigns } from '@/lib/fund/data';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';
import { HeroFade } from '@/components/hub/hero-fade';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryGrid } from '@/components/hub/category-grid';
import { NewsStrip } from '@/components/hub/news-column';
import { HubSection } from '@/components/hub/hub-section';
import { categories } from '@/data/navigation';

// Cached and refreshed every minute (and instantly when the admin saves) so the "live campaigns"
// badge stays current without making `/` dynamic.
export const revalidate = 60;

const SECTIONS = [
  { id: 'news', title: 'News', subtitle: 'Fresh stories from the weapons, car and tech feeds', accent: '#fb923c' },
  { id: 'productivity', title: 'Productivity', subtitle: 'Free tools that run right in your browser', accent: '#2dd4bf' },
  { id: 'personal', title: 'Personal & Boards', subtitle: 'Boards, photography, events, video and more', accent: '#c8a96a' },
] as const;
const GROUP = new Map(categories.map((c) => [c.id, c.group ?? 'personal']));
// Boards and galleries lead the personal section.
const FIRST = ['fishboards', 'meatboards', 'photography', 'events'];

export default async function HomePage() {
  const [settings, liveCampaigns] = await Promise.all([loadSettings(), listPublicCampaigns().then((c) => c.length).catch(() => 0)]);
  // A greyed-out box's description is private too: it never reaches the page.
  const all = resolveCards(settings).map((c) => (c.greyed ? { ...c, teaser: '' } : c));
  const groups = { news: [] as typeof all, productivity: [] as typeof all, personal: [] as typeof all };
  for (const c of all) groups[GROUP.get(c.id) ?? 'personal'].push(c);
  const rank = (id: string) => (FIRST.includes(id) ? FIRST.indexOf(id) : FIRST.length);
  groups.personal.sort((a, b) => rank(a.id) - rank(b.id));
  return (
    <>
      <HeroFade>
        <HubHero tagline={settings.hero.tagline} logoSrc={settings.hero.logoPath ? mediaUrl(settings.hero.logoPath) : undefined} />
      </HeroFade>
      <div className="relative z-10 mx-auto max-w-7xl space-y-12 px-4 pb-20 sm:px-6 sm:pb-28">
        {SECTIONS.map((sec) => {
          const cards = groups[sec.id];
          if (!cards.length && sec.id !== 'news') return null;
          return (
            <HubSection key={sec.id} id={sec.id} title={sec.title} subtitle={sec.subtitle} accent={sec.accent}>
              {sec.id === 'news' && <NewsStrip />}
              {cards.length > 0 && <CategoryGrid cards={cards} liveCampaigns={liveCampaigns} />}
            </HubSection>
          );
        })}
      </div>
    </>
  );
}
