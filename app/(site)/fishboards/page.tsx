import { Sparkles } from 'lucide-react';
import { CategoryPage } from '@/components/hub/category-page';
import { BoardBuilder } from '@/components/fishboard/board-builder';

export const revalidate = 60;

export const metadata = { title: 'Fish Boards', description: 'Custom fish boards — design your own, live, and send it straight to Yaakov.' };

const ACCENT = '#f4895f';

export default function Page() {
  return (
    <CategoryPage
      id="fishboards"
      extraCta={<a href="#builder" className="inline-flex h-12 items-center gap-2 rounded-full px-6 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-neutral-950 shadow-[0_0_28px_-6px_#f4895f] transition active:scale-[0.98]" style={{ background: ACCENT }}><Sparkles className="size-4" /> Design your own</a>}
      extra={<BoardBuilder accent={ACCENT} />}
    />
  );
}
