import { hasAccess } from '@/lib/access/visitor';
import { isAdmin } from '@/lib/admin/session';
import { isBlobConfigured, readFileStream } from '@/lib/admin/store';
import { loadSettingsFast } from '@/lib/site/load';
import { HERO_PATH, PHOTO_PATH, resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404 });

// How long copies may be kept. File names are unique per upload (a replaced photo gets a new name), so the file itself never
// goes stale: the only reason to re-check is access (a box being locked or someone's approval being withdrawn).
//  - public photos: a day in the visitor's browser, five minutes in the shared CDN (so a box you lock stops being served quickly)
//  - locked photos: only the approved visitor's own browser may keep them, for ten minutes; never a shared cache
const PUBLIC_CACHE = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800';
const LOCKED_CACHE = 'private, max-age=86400, stale-while-revalidate=604800';

/**
 * Serves private blobs after checking permission: photos in a locked category need the admin or an approved visitor;
 * everything else is public. Nothing here has a public storage URL. Supports ETag / If-None-Match so a repeat view costs
 * a tiny "not modified" answer instead of the whole image.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isBlobConfigured) return notFound();
  const pathname = (await params).path.join('/');
  const settings = await loadSettingsFast();
  let locked = false;

  // The owner sees fresh uploads right away (before pressing Save); visitors only see saved ones.
  const admin = await isAdmin();
  if (HERO_PATH.test(pathname)) {
    if (settings.hero.logoPath !== pathname && !admin) return notFound();
  } else if (PHOTO_PATH.test(pathname)) {
    const category = pathname.split('/')[1];
    const saved = settings.photos[category]?.some((p) => p.pathname === pathname);
    if (!saved && !admin) return notFound();
    if (!saved) locked = true; // never cache an unsaved upload publicly
    else locked = Boolean(resolveCards(settings, { includeHidden: true }).find((c) => c.id === category)?.locked);
    if (locked && !admin && !(await hasAccess(category))) return new Response('Locked', { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  } else {
    return notFound();
  }

  const cacheControl = locked ? LOCKED_CACHE : PUBLIC_CACHE;
  const file = await readFileStream(pathname, request.headers.get('if-none-match') ?? undefined).catch(() => null);
  if (!file) return notFound();
  const etag = file.etag;
  if (file.status === 304) return new Response(null, { status: 304, headers: { 'Cache-Control': cacheControl, ...(etag ? { ETag: etag } : {}) } });
  return new Response(file.body, {
    headers: {
      'Content-Type': file.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheControl,
      Vary: 'Cookie',
      ...(etag ? { ETag: etag } : {}),
    },
  });
}
