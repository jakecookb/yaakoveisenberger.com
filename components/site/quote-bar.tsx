import { QuoteButton } from '@/components/hub/quote-form';

/** Compact glass "Request a Quote" bar at the very bottom of every page, framed by accent lines above and below. */
export function QuoteBar() {
  const line = 'absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#c8a96a] to-transparent';
  return (
    <aside aria-label="Request a quote" className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl">
      <span aria-hidden className={`${line} top-0`} />
      <span aria-hidden className={`${line} bottom-0`} />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">
          <span className="text-[#c8a96a]">Quotes</span> · Boards · Events · Photography · Web &amp; App Design · Music Production
        </p>
        <QuoteButton category="fishboards" accent="#c8a96a" compact />
      </div>
    </aside>
  );
}
