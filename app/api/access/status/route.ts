import { NextResponse } from 'next/server';
import { accessState, accessStates } from '@/lib/access/visitor';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

/** `?cat=<id>` → one box's status. `?all=1` → status of every locked box (to label the cards on the home page). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let body: unknown;
  if (params.get('all')) {
    const locked = resolveCards(await loadSettings(), { includeHidden: true }).filter((c) => c.locked).map((c) => c.id);
    body = { states: await accessStates(locked) };
  } else {
    body = await accessState(params.get('cat') ?? '');
  }
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
