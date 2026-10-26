import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { SiteBackdrop } from '@/components/site/backdrop';
import { BackBar } from '@/components/site/nav-drawer';
import { Tracker } from '@/components/site/tracker';
import { Announcement } from '@/components/site/announcement';
import { loadSettings } from '@/lib/site/load';

// Shared chrome for the main site's pages. Add new pages as folders next to page.tsx
// (e.g. app/(site)/about/page.tsx → /about). The /fund platform has its own layout.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { site } = await loadSettings();
  return (
    <div className="site-dark isolate min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">
      <SiteBackdrop />
      <Announcement site={site} />
      <SiteHeader />
      <BackBar />
      <main>{children}</main>
      <SiteFooter />
      <Tracker />
    </div>
  );
}
