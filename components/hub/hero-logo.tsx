'use client';

import Image, { type StaticImageData } from 'next/image';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

const SIZE = 'size-52 sm:size-64 lg:size-80';

/**
 * The logo on a floating slab of "liquid glass": frosted translucent pane with a bright rim, a specular
 * highlight and a slow light sweep, drifting colour orbs behind it for the glass to refract, a soft floor shadow
 * and a gentle tilt that follows the pointer. All motion is switched off for people who prefer reduced motion.
 */
export function HeroLogo({ logo, customSrc }: { logo: StaticImageData; customSrc?: string }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), { stiffness: 110, damping: 14 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-11, 11]), { stiffness: 110, damping: 14 });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  const drift = (x: number, y: number, d: number) => (reduce ? undefined : { x: [0, x, 0], y: [0, y, 0], transition: { duration: d, repeat: Infinity, ease: 'easeInOut' as const } });

  return (
    <div className="relative mx-auto w-fit [perspective:1100px]" onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* colour the glass can refract */}
      <div aria-hidden className="pointer-events-none absolute -inset-10 sm:-inset-16">
        <motion.span animate={drift(24, 18, 9)} className="absolute -left-2 top-4 size-40 rounded-full bg-[#c8a96a]/50 blur-3xl sm:size-56" />
        <motion.span animate={drift(-20, 26, 11)} className="absolute -right-2 top-1/3 size-36 rounded-full bg-violet-500/40 blur-3xl sm:size-52" />
        <motion.span animate={drift(16, -22, 13)} className="absolute bottom-0 left-1/4 size-32 rounded-full bg-cyan-400/35 blur-3xl sm:size-48" />
      </div>

      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={reduce ? undefined : { y: [0, -14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-[2.75rem] border border-white/30 bg-gradient-to-br from-white/30 via-white/[0.07] to-white/20 p-3 backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[3.25rem] sm:p-4 shadow-[0_40px_90px_-25px_rgba(0,0,0,0.85),0_0_60px_-10px_rgba(200,169,106,0.35),inset_0_1.5px_0_rgba(255,255,255,0.65),inset_0_-1.5px_0_rgba(255,255,255,0.18),inset_1.5px_0_0_rgba(255,255,255,0.22),inset_-1.5px_0_0_rgba(255,255,255,0.1)]"
      >
        {customSrc ? (
          <img src={customSrc} alt="" className={`${SIZE} rounded-[2rem] object-cover ring-1 ring-white/25 sm:rounded-[2.5rem]`} />
        ) : (
          <Image src={logo} alt="" priority className={`${SIZE} rounded-[2rem] ring-1 ring-white/25 sm:rounded-[2.5rem]`} />
        )}

        {/* specular highlight + sweeping sheen, clipped to the pane */}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.08)_28%,rgba(255,255,255,0)_55%,rgba(255,255,255,0.14)_100%)]" />
          {!reduce && (
            <motion.span
              initial={{ x: '-140%' }}
              animate={{ x: '260%' }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          )}
        </span>
      </motion.div>

      {/* floor shadow: shrinks as the glass floats up */}
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { scaleX: [1, 0.82, 1], opacity: [0.75, 0.4, 0.75] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto mt-8 h-6 w-3/4 rounded-[100%] bg-black/70 blur-xl"
      />
    </div>
  );
}
