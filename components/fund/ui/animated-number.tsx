'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { formatMoney } from '@/lib/fund/format';

/**
 * Smoothly springs to new values without re-rendering React on every frame
 * (the MotionValue is rendered directly into the DOM).
 */
export function AnimatedMoney({ cents, currency = 'usd', className, stiffness = 60 }: { cents: number; currency?: string; className?: string; stiffness?: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(cents, { stiffness, damping: 20, mass: 1 });
  const text = useTransform(spring, (v) => formatMoney(Math.round(v / 100) * 100, currency, { cents: false }));
  useEffect(() => {
    if (reduce) spring.jump(cents);
    else spring.set(cents);
  }, [cents, reduce, spring]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });
  const text = useTransform(spring, (v) => new Intl.NumberFormat('en-US').format(Math.round(v)));
  useEffect(() => spring.set(value), [value, spring]);
  return <motion.span className={className}>{text}</motion.span>;
}
