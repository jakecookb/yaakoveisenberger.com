import Link from 'next/link';
import { cn } from '../ui/cn';

/** URL-driven tabs (?tab=) so every view is linkable and server-rendered. */
export function LinkTabs({ tabs, active, base, extra }: { tabs: { id: string; label: string; count?: number }[]; active: string; base: string; extra?: Record<string, string> }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm">
      {tabs.map((t) => {
        const qs = new URLSearchParams({ ...extra, tab: t.id });
        return (
          <Link
            key={t.id}
            href={`${base}?${qs}`}
            className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 transition', active === t.id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
          >
            {t.label}
            {t.count != null && <span className={cn('rounded-full px-1.5 text-xs', active === t.id ? 'bg-slate-100' : 'bg-slate-200/70')}>{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
