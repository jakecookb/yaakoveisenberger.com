'use client';

import { useEffect, useState } from 'react';

const HEADER = 56;

/** A homepage section with its label in the flow; the sticky stacked copy is drawn by <SectionStack>. */
export function HubSection({ id, title, subtitle, accent, children }: { id: string; title: string; subtitle: string; accent: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28">
      <div className="mb-4 flex items-baseline gap-3 py-2">
        <span className="h-px w-8 self-center" style={{ background: accent }} />
        <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{title}</h2>
        <p className="hidden truncate text-sm text-neutral-500 sm:block">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

type Row = { id: string; title: string; accent: string; state: 'current' | 'past'; fade: number };

/**
 * Sticky labels under the header: the section you're in shows full size; sections you've scrolled past stack on top of
 * it, smaller and dimmer, and fade away as you keep going.
 */
export function SectionStack({ sections }: { sections: { id: string; title: string; accent: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const out: Row[] = [];
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top > HEADER + 4) continue; // not reached yet (its own label is still on screen)
        if (r.bottom > HEADER + 60) out.push({ ...s, state: 'current', fade: 1 });
        else out.push({ ...s, state: 'past', fade: Math.max(0, 1 - (HEADER + 60 - r.bottom) / 420) });
      }
      // While a section's own title is passing under the header, show nothing (no overlap with it).
      const passing = sections.some((s) => { const t = document.getElementById(s.id)?.getBoundingClientRect().top ?? 1e9; return t > HEADER - 30 && t < HEADER + 70; });
      setRows(passing ? [] : out.filter((r) => r.fade > 0.02));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [sections]);
  return (
    <div className="pointer-events-none sticky top-14 z-30 h-0" aria-hidden>
      <div className="flex flex-col items-start gap-1 pt-2">
        {rows.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950/70 px-3 py-1 font-mono font-semibold uppercase ring-1 ring-white/10 backdrop-blur-md transition-all duration-300"
            style={{ color: r.accent, opacity: r.state === 'current' ? 1 : 0.55 * r.fade, fontSize: r.state === 'current' ? 11 : 9, letterSpacing: '0.3em', transform: `translateY(${r.state === 'current' ? 0 : -2}px) scale(${r.state === 'current' ? 1 : 0.92})`, transformOrigin: 'left center' }}
          >
            <span className="size-1.5 rounded-full" style={{ background: r.accent }} />{r.title}
          </span>
        ))}
      </div>
    </div>
  );
}
