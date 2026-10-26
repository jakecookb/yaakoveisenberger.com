import Link from 'next/link';
import type { SiteSettings, Tone } from '@/lib/site/settings';
import { isSafeUrl } from '@/lib/site/settings';

const TONE: Record<Tone, string> = {
  info: 'bg-[#c8a96a]/15 text-[#ecdcb4] border-[#c8a96a]/30',
  good: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30',
  warn: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
};

/** The owner's announcement strip above the header (turned on from the editor's Site tab). Also used by the editor preview. */
export function Announcement({ site }: { site: SiteSettings['site'] }) {
  const a = site.announcement;
  if (!a?.enabled || !a.text) return null;
  const inner = <span>{a.text}{a.link && isSafeUrl(a.link) ? <span className="ml-2 underline underline-offset-2">Learn more →</span> : null}</span>;
  const cls = `block border-b px-4 py-2 text-center text-xs font-medium sm:text-sm ${TONE[a.tone ?? 'info']}`;
  return a.link && isSafeUrl(a.link)
    ? <Link href={a.link} className={`${cls} hover:brightness-125`}>{inner}</Link>
    : <div role="status" className={cls}>{inner}</div>;
}
