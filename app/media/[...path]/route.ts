import { get } from '@vercel/blob';
import { hasAccess } from '@/lib/access/visitor';
import { isBlobConfigured } from '@/lib/admin/store';
import { loadSettings } from '@/lib/site/load';
import { HERO_PATH, PHOTO_PATH, resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves private blobs after checking permission: photos in a locked category need the admin or an
 * approved visitor; everything else is public. Nothing here has a public storage URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isBlobConfigured) return notFound();
  const pathname = (await params).path.join('/');
  const settings = await loadSettings();
  let locked = false;

  if (HERO_PATH.test(pathname)) {
    if (settings.hero.logoPath !== pathname) return notFound();
  } else if (PHOTO_PATH.test(pathname)) {
    const category = pathname.split('/')[1];
    if (!settings.photos[category]?.some((p) => p.pathname === pathname)) return notFound();
    locked = Boolean(resolveCards(settings, { includeHidden: true }).find((c) => c.id === category)?.locked);
    if (locked && !(await hasAccess(category))) return new Response('Locked', { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  } else {
    return notFound();
  }

  const blob = await get(pathname, { access: 'private' }).catch(() => null);
  if (!blob || blob.statusCode !== 200) return notFound();
  return new Response(blob.stream, {
    headers: {
      'Content-Type': blob.blob.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': locked ? 'private, no-store' : 'public, max-age=300, s-maxage=60, stale-while-revalidate=60',
    },
  });
}
