import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/access/visitor';
import { loadSettingsFast } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

/** Content of a locked page. Only returned to the admin or a visitor the admin approved. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await loadSettingsFast();
  const card = resolveCards(settings, { includeHidden: true }).find((c) => c.id === id);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  if (card.locked && !(await hasAccess(id))) return NextResponse.json({ error: 'Locked' }, { status: 403, headers });
  return NextResponse.json(
    {
      body: settings.pages[id]?.body ?? '',
      photos: (settings.photos[id] ?? []).map((p) => ({ id: p.id, src: mediaUrl(p.pathname), caption: p.caption })),
    },
    { headers },
  );
}
