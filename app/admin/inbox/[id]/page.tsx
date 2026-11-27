import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MailView } from '@/components/admin/mail-view';
import { requireAdmin } from '@/lib/admin/session';
import { getMail, setRead } from '@/lib/mail/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email' };

export default async function MailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const meta = await getMail(id);
  if (!meta) notFound();
  if (!meta.read) await setRead(id, true);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/inbox" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Inbox</Link>
      <MailView meta={{ ...meta, read: true }} />
    </main>
  );
}
