import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/access/visitor';
import { loadSettings } from '@/lib/site/load';
import { isSafeUrl, linkTarget, resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

/**
 * Where a locked link box sends people. The real website address is only revealed (as a redirect) to the
 * admin or a visitor the owner approved; everyone else is sent to the "type your name" screen.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await loadSettings();
  const card = resolveCards(settings, { includeHidden: true }).find((c) => c.id === id && c.kind === 'link');
  const target = linkTarget(settings, id);
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  if (!card || !isSafeUrl(target)) return new NextResponse('Not found', { status: 404, headers });
  if (card.locked && !(await hasAccess(id))) return NextResponse.redirect(new URL(`/access/${id}`, request.url), { status: 302, headers });
  return NextResponse.redirect(new URL(target, request.url), { status: 302, headers });
}
