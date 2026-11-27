import Link from 'next/link';
import { ArrowLeft, Inbox, Paperclip, Send, TriangleAlert } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/session';
import { decodeHeader, listMail, listSent, splitAddress } from '@/lib/mail/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inbox' };

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', ...(today ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' }) });
};
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  await requireAdmin();
  const sent = (await searchParams).box === 'sent';
  const [mail, out] = await Promise.all([sent ? Promise.resolve([]) : listMail(), sent ? listSent() : Promise.resolve([])]);
  const unread = mail.filter((m) => !m.read).length;
  const forwardProblem = mail.slice(0, 5).find((m) => m.forwardError);
  const tab = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${on ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10'}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Inbox</h1>
      <p className="mt-1 max-w-lg text-sm text-neutral-400">Email sent to your yaakoveisenberger.com addresses. A copy still goes to your Gmail as before.</p>
      <div className="mt-5 flex gap-2">
        <Link href="/admin/inbox" className={tab(!sent)}><Inbox className="size-3.5" /> Inbox{unread > 0 && !sent ? ` (${unread})` : ''}</Link>
        <Link href="/admin/inbox?box=sent" className={tab(sent)}><Send className="size-3.5" /> Sent</Link>
      </div>

      {forwardProblem && !sent && (
        <p className="mt-4 flex gap-2 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> Recent emails were saved here but could not be forwarded to Gmail ({forwardProblem.forwardError}). Check that the address is still verified under Cloudflare → Email Routing → Destination addresses.</p>
      )}

      <ul className="mt-5 divide-y divide-white/5 overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10">
        {!sent && mail.length === 0 && <li className="p-6 text-sm text-neutral-500">No emails yet. New mail shows up here as soon as it arrives.</li>}
        {sent && out.length === 0 && <li className="p-6 text-sm text-neutral-500">Replies you send from here show up in this list.</li>}
        {!sent && mail.map((m) => {
          const from = splitAddress(m.fromHeader || m.from);
          return (
            <li key={m.id}>
              <Link href={`/admin/inbox/${m.id}`} className="flex items-start gap-3 p-4 transition hover:bg-white/5">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${m.read ? 'bg-transparent' : 'bg-[#c8a96a]'}`} aria-label={m.read ? undefined : 'Unread'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate ${m.read ? 'text-neutral-300' : 'font-semibold text-white'}`}>{from.name || from.email}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{when(m.at)}</span>
                  </span>
                  <span className={`block truncate text-sm ${m.read ? 'text-neutral-400' : 'text-neutral-200'}`}>{decodeHeader(m.subject) || '(no subject)'}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">to {m.to} · {kb(m.size)}{m.size > 60_000 && <Paperclip className="size-3" />}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {sent && out.map((s) => (
          <li key={s.id} className="p-4">
            <div className="flex items-baseline justify-between gap-3"><span className="truncate text-neutral-200">To {s.to}</span><span className="shrink-0 text-xs text-neutral-500">{when(s.at)}</span></div>
            <p className="truncate text-sm text-neutral-400">{s.subject}</p>
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-neutral-500">{s.text}</p>
            {s.inReplyTo && <Link href={`/admin/inbox/${s.inReplyTo}`} className="mt-1 inline-block text-xs text-[#c8a96a]">Open the original</Link>}
          </li>
        ))}
      </ul>
    </main>
  );
}
