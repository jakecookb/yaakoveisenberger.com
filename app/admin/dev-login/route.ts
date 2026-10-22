import { timingSafeEqual } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { BYPASS_KEY, LOCAL_DEV, startAdminSession } from '@/lib/admin/session';

/**
 * Test sign-in: /admin/dev-login?key=<ADMIN_BYPASS_KEY>&next=/path sets a normal admin session cookie and redirects.
 * No key needed under `next dev` on your own machine. Everywhere else it 404s unless ADMIN_BYPASS_KEY is set and matches.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const given = Buffer.from(url.searchParams.get('key') ?? '');
  const want = Buffer.from(BYPASS_KEY);
  const keyOk = BYPASS_KEY !== '' && given.length === want.length && timingSafeEqual(given, want);
  if (!LOCAL_DEV && !keyOk) notFound();
  await startAdminSession();
  const next = url.searchParams.get('next') ?? '/admin';
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/admin');
}
