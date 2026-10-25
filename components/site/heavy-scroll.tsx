'use client';

import { useEffect } from 'react';

const EASE = 0.065; // fraction of the remaining distance covered per frame (lower = heavier)
const WHEEL = 0.5; // damps each wheel notch so a flick travels a deliberate distance
const MAX_STEP = 140; // largest single wheel event counted (px), so a hard flick can't dump a huge distance at once
const MAX_LEAD = 480; // furthest (px) the glide target may run ahead of the page: a fast spin can't make the page rush off

/**
 * Gives mouse-wheel scrolling weight: the page glides toward its target and settles instead of snapping. Desktop wheel
 * only: touch, keyboard, scrollbar drags, pinch-zoom and reduced-motion all keep native scrolling.
 */
export function HeavyScroll() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return heavyTouch();
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
      const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, e.deltaY * unit)) * WHEEL;
      target = clamp(Math.max(current - MAX_LEAD, Math.min(current + MAX_LEAD, target + step)));
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

const DRAG = 0.55; // the page follows the finger at this fraction, so it takes a firmer pull to move it
const FRICTION = 0.935; // per 16ms frame: momentum dies quickly instead of coasting
const MAX_V = 1.1; // fastest fling (px/ms) that momentum may carry, however hard the flick

/** Touch scrolling with weight: the page follows the finger at a fraction of its speed and a flick carries a short, capped distance. */
function heavyTouch() {
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto'; // the page's CSS smooth-scroll would otherwise fight every per-frame scrollTo
  let y0 = 0, x0 = 0, base = 0, dragging = false, locked: 'v' | 'h' | null = null, raf = 0, v = 0, last = 0;
  const samples: [number, number][] = [];
  const max = () => root.scrollHeight - window.innerHeight;
  const clamp = (y: number) => Math.min(max(), Math.max(0, y));
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const scrollable = (el: EventTarget | null) => {
    for (let n = el as HTMLElement | null; n && n !== root; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight) || ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth)) return true;
    }
    return false;
  };
  const onStart = (e: TouchEvent) => {
    stop();
    if (e.touches.length !== 1 || scrollable(e.target) || document.body.style.overflow === 'hidden') { dragging = false; return; }
    dragging = true; locked = null; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; base = window.scrollY; samples.length = 0;
  };
  const onMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!locked) { if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return; locked = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h'; }
    if (locked === 'h') return;
    if (e.cancelable) e.preventDefault();
    window.scrollTo(0, clamp(base - dy * DRAG));
    const t = performance.now();
    samples.push([t, window.scrollY]);
    while (samples.length > 1 && t - samples[0][0] > 100) samples.shift();
  };
  const onEnd = () => {
    if (!dragging || locked !== 'v') { dragging = false; return; }
    dragging = false;
    const a = samples[0], b = samples[samples.length - 1];
    if (!a || !b || b[0] - a[0] < 8 || performance.now() - b[0] > 80) return;
    v = Math.max(-MAX_V, Math.min(MAX_V, (b[1] - a[1]) / (b[0] - a[0])));
    last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(48, t - last); last = t;
      const before = window.scrollY;
      window.scrollTo(0, clamp(before + v * dt));
      v *= Math.pow(FRICTION, dt / 16);
      raf = Math.abs(v) < 0.03 || window.scrollY === before ? 0 : requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onEnd, { passive: true });
  return () => {
    stop();
    root.style.scrollBehavior = '';
    window.removeEventListener('touchstart', onStart);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    window.removeEventListener('touchcancel', onEnd);
  };
}
