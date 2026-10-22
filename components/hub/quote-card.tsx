import { QuoteButton } from './quote-form';

/** Frosted-glass "Request a Quote" call to action near the bottom of the home page. */
export function QuoteCard() {
  return (
    <section aria-labelledby="quote-cta" className="relative overflow-hidden rounded-3xl bg-white/[0.04] px-6 py-10 text-center ring-1 ring-white/15 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_80px_-40px_rgba(200,169,106,0.5)] sm:px-12 sm:py-14">
      <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-[#c8a96a]/20 blur-3xl" />
      <p className="relative font-mono text-[10px] uppercase tracking-[0.35em] text-[#c8a96a]">Fish Boards · Meat Boards · Events · Photography</p>
      <h2 id="quote-cta" className="relative mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Planning something? Get a quote.</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-neutral-400">Tell me the date, the guest count and what you have in mind — pricing comes straight to your inbox.</p>
      <div className="relative"><QuoteButton category="fishboards" accent="#c8a96a" /></div>
    </section>
  );
}
