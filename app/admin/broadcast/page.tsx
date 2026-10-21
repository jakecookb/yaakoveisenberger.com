import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BroadcastForm } from '@/components/admin/broadcast-form';
import { requireAdmin } from '@/lib/admin/session';
import { audience, listSubscribers, TOPICS, topicLabel } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscribers & announcements' };

export default async function BroadcastPage() {
  await requireAdmin();
  const subs = await listSubscribers();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Subscribers & announcements</h1>
      <p className="mt-1 text-sm text-neutral-400">{subs.length} subscriber{subs.length === 1 ? '' : 's'}. Every email includes a one-click unsubscribe link.</p>
      <div className="mt-6"><BroadcastForm topics={TOPICS.map((t) => ({ id: t.id, label: t.label, count: audience(subs, t.id).length }))} /></div>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">Subscribers</h2>
      <ul className="mt-3 divide-y divide-white/5 rounded-2xl ring-1 ring-white/10">
        {subs.length === 0 && <li className="p-4 text-sm text-neutral-500">No one yet — the sign-up form is at the bottom of every page.</li>}
        {subs.map((s) => <li key={s.email} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span className="text-white">{s.email}</span><span className="text-neutral-400">{s.topics.map(topicLabel).join(', ')} · {new Date(s.createdAt).toLocaleDateString('en-US')}</span></li>)}
      </ul>
    </main>
  );
}
