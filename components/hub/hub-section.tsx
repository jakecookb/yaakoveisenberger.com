'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/** A homepage section whose sticky heading fades, blurs and drifts away as the section scrolls past (like the logo). */
export function HubSection({ id, title, subtitle, accent, children }: { id: string; title: string; subtitle: string; accent: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 72px', 'end 160px'] });
  const opacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 0.9, 0]);
  const blur = useTransform(scrollYProgress, [0.6, 1], ['blur(0px)', 'blur(8px)']);
  const y = useTransform(scrollYProgress, [0.6, 1], [0, -12]);
  return (
    <section ref={ref} id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <motion.div style={reduce ? undefined : { opacity, filter: blur, y }} className="sticky top-14 z-20 -mx-4 mb-4 px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="h-px w-8 self-center" style={{ background: accent }} />
          <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{title}</h2>
          <p className="hidden truncate text-sm text-neutral-500 sm:block">{subtitle}</p>
        </div>
      </motion.div>
      {children}
    </section>
  );
}
