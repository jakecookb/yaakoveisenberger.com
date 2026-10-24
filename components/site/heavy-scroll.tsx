'use client';

import { useEffect } from 'react';

const EASE = 0.11; // fraction of the remaining distance covered per frame (lower = heavier)
const WHEEL = 0.8; // damps each wheel notch so a flick travels a deliberate distance

/**
 * Gives mouse-wheel scrolling weight: the page glides toward its target and settles instead of snapping. Desktop wheel
 * only: touch, keyboard, scrollbar drags, pinch-zoom and reduced-motion all keep native scrolling.
 */
export function HeavyScroll() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    let target = window.scrollY, current = target, raf = 0;
    const max = () => root.scrollHeight - window.innerHeight;
    const clamp = (y: number) => Math.min(max(), Math.max(0, y));
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const scrollable = (el: EventTarget | null) => {
      for (let n = el as HTMLElement | null; n && n !== root; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return true;
      }
      return false;
    };
    const tick = () => {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.4) current = target;
      window.scrollTo(0, current);
      raf = current === target ? 0 : requestAnimationFrame(tick);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY) || document.body.style.overflow === 'hidden' || scrollable(e.target)) return;
      e.preventDefault();
      if (!raf) { current = window.scrollY; target = current; }
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = clamp(target + e.deltaY * unit * WHEEL);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // Anything else that moves the page (keys, anchors, scrollbar) wins: resync and stop gliding.
    const onNative = () => { if (!raf) { current = target = window.scrollY; } };
    root.style.scrollBehavior = 'auto';
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onNative, { passive: true });
    window.addEventListener('keydown', stop);
    window.addEventListener('pointerdown', stop);
    return () => {
      stop();
      root.style.scrollBehavior = '';
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onNative);
      window.removeEventListener('keydown', stop);
      window.removeEventListener('pointerdown', stop);
    };
  }, []);
  return null;
}
