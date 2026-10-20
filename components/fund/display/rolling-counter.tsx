'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatMoney } from '@/lib/fund/format';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** One odometer wheel. Only a transform animates, so nothing reflows. */
const Wheel = memo(function Wheel({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: '1.1em', lineHeight: '1.1em' }}>
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-value * 10}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 55, damping: 16, mass: 1.1 }}
      >
        {DIGITS.map((d) => (
          <span key={d} style={{ height: '1.1em' }}>{d}</span>
        ))}
      </motion.span>
    </span>
  );
});

/**
 * Giant rolling dollar counter. Characters are keyed by their position from the
 * right, so existing wheels keep their identity as the number grows.
 */
export function RollingCounter({ cents, currency = 'usd', className }: { cents: number; currency?: string; className?: string }) {
  const text = formatMoney(Math.round(cents / 100) * 100, currency, { cents: false });
  const chars = text.split('');
  return (
    <span className={`fund-tabular inline-flex items-start whitespace-nowrap ${className ?? ''}`} aria-label={text} role="text">
      {chars.map((ch, i) => {
        const pos = chars.length - i;
        return /\d/.test(ch) ? (
          <Wheel key={`d${pos}`} value={Number(ch)} />
        ) : (
          <span key={`s${pos}${ch}`} style={{ height: '1.1em', lineHeight: '1.1em' }}>{ch}</span>
        );
      })}
    </span>
  );
}
