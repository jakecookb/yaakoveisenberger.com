import { NextResponse } from 'next/server';
import { accessState, accessStates, renewVisitorCookie } from '@/lib/access/visitor';
import { isAdmin } from '@/lib/admin/session';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

/** `?cat=<id>` → one box's status. `?all=1` → status of every locked box (to label the cards on the home page). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let body: unknown;
  if (params.get('all')) {
    const locked = resolveCards(await loadSettings(), { includeHidden: true }).filter((c) => c.locked).map((c) => c.id);
    const states = await accessStates(locked);
    body = { states };
    // An approved visitor who comes back keeps their access: extend the cookie's life.
    if (Object.values(states).some((x) => x.state === 'approved') && !(await isAdmin())) await renewVisitorCookie();
  } else {
    body = await accessState(params.get('cat') ?? '');
  }
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
