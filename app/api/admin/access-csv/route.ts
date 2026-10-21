import { categories } from '@/data/navigation';
import { isAdmin } from '@/lib/admin/session';
import { toCsv } from '@/lib/access/csv';
import { listRequests } from '@/lib/access/visitor';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';

/** Every sign-up as a spreadsheet (admin only). */
export async function GET() {
  if (!(await isAdmin())) return new Response('Not allowed', { status: 401 });
  const [rows, settings] = await Promise.all([listRequests(), loadSettings()]);
  const cards = resolveCards(settings, { includeHidden: true });
  const title = (id: string) => cards.find((c) => c.id === id)?.title ?? categories.find((c) => c.id === id)?.title ?? id;
  const day = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows, title), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yaakoveisenberger-signups-${day}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
