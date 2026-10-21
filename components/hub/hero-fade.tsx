'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/**
 * Keeps the hero pinned behind the page while the tiles scroll up over it; as you scroll, the logo shrinks, blurs and
 * fades away so it seems to slip underneath the tiles.
 */
export function HeroFade({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 120, 420], [1, 0.9, 0]);
  const scale = useTransform(scrollY, [0, 420], [1, 0.86]);
  const y = useTransform(scrollY, [0, 420], [0, 70]);
  const blur = useTransform(scrollY, [0, 420], ['blur(0px)', 'blur(12px)']);
  return (
    <div className={`z-0 ${reduce ? '' : 'sticky top-0'}`} style={{ pointerEvents: 'none' }}>
      <motion.div style={reduce ? undefined : { opacity, scale, y, filter: blur, transformOrigin: '50% 30%', willChange: 'transform, opacity, filter' }}>{children}</motion.div>
    </div>
  );
}
