import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { SiteBackdrop } from '@/components/site/backdrop';

// Shared chrome for the main site's pages. Add new pages as folders next to page.tsx
// (e.g. app/(site)/about/page.tsx → /about). The /fund platform has its own layout.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-dark isolate min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">
      <SiteBackdrop />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
