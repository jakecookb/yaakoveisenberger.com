import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MaintenanceEditor } from '@/components/admin/maintenance-editor';
import { loadMaintenance } from '@/app/admin/maintenance/actions';
import { requireAdmin } from '@/lib/admin/session';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Closed for now' };

export default async function MaintenancePage() {
  await requireAdmin();
  const [config, settings] = await Promise.all([loadMaintenance(), loadSettings()]);
  const cards = resolveCards(settings, { includeHidden: true });
  // Sections that can stay open while the rest is closed (pages on this site), plus the Cookbook.
  const sections = [...cards.filter((c) => c.href.startsWith('/')).map((c) => ({ href: c.href, title: c.title })), { href: '/cookbook', title: 'Cookbook' }];
  // Background choices: photos from boxes anyone can see (a locked box's photos wouldn't load for visitors).
  const open = new Set(cards.filter((c) => !c.locked).map((c) => c.id));
  const photos = Object.entries(settings.photos).filter(([id]) => open.has(id)).flatMap(([, ps]) => ps.map((p) => mediaUrl(p.pathname))).slice(0, 60);
  const heroLogoUrl = settings.hero.logoPath ? mediaUrl(settings.hero.logoPath) : '';

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Closed for now</h1>
      <p className="mt-1 max-w-xl text-sm text-neutral-400">Take the site offline for a while: visitors see the page you design here instead of the site. You stay signed in and still see the real site. Turning it on or off takes effect in about 10 seconds.</p>
      <MaintenanceEditor initial={{ ...config, heroLogoUrl }} sections={sections} photos={photos} />
    </main>
  );
}
