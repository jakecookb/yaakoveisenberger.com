import { isAdmin } from '@/lib/admin/session';
import { rawMail } from '@/lib/mail/store';

export const dynamic = 'force-dynamic';

/** The raw message (.eml) for the admin inbox; the browser opens it. Admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401, headers });
  const file = await rawMail((await params).id).catch(() => null);
  if (!file?.body) return new Response('Not found', { status: 404, headers });
  return new Response(file.body, { headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="message.eml"' } });
}
