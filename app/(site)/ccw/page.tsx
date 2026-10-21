import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { CcwDashboard } from '@/components/ccw/ccw-dashboard';

export const metadata = { title: 'CCW Reciprocity & Carry Laws', description: 'Pick up to four permits and see where you can carry in all 50 states + DC — with each state’s rules.' };

export default function Page() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#f59e0b' }}><ShieldCheck className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">CCW Reciprocity & Carry Laws</h1>
            <p className="mt-1 text-neutral-400">Pick up to four permits and see where you can carry in all 50 states + DC — with each state’s rules.</p>
          </div>
        </div>
        <div className="mt-8">
          <CcwDashboard />
        </div>
        <div className="mt-10 rounded-2xl bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100/90 ring-1 ring-amber-400/30">
          <b>Not legal advice.</b> Summarised from the state-by-state guides at handgunlaw.us (each state shows its guide’s update date, all August–October 2026) and checked for consistency, but carry laws change often and details depend on your situation. Confirm with the state’s own sources — each state links to its full guide — before you carry or travel. “Not stated” means the guide didn’t cover it.
        </div>
      </div>
    </section>
  );
}
