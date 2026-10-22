'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Visit analytics: one record per browser tab visit (pages with time spent, and what was clicked), sent when the tab
// is hidden or closed. The server adds IP and approximate location. Admin pages are never tracked.

interface Page { path: string; at: number; ms: number }
const visit = { id: '', vid: '', referrer: '', pages: [] as Page[], clicks: [] as { path: string; target: string; at: number }[], sent: '' };
let current: { path: string; start: number } | null = null;

function ids() {
  if (visit.id) return;
  const rnd = () => crypto.getRandomValues(new Uint32Array(3)).join('').slice(0, 20);
  try { visit.vid = localStorage.getItem('ve_vid') || rnd(); localStorage.setItem('ve_vid', visit.vid); } catch { visit.vid = rnd(); }
  try { visit.id = sessionStorage.getItem('ve_visit') || rnd(); sessionStorage.setItem('ve_visit', visit.id); } catch { visit.id = rnd(); }
  visit.referrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer.slice(0, 300) : '';
  // Full page loads in the same tab continue the same visit.
  try { const d = JSON.parse(sessionStorage.getItem('ve_visit_data') ?? 'null'); if (d) { visit.pages = d.pages ?? []; visit.clicks = d.clicks ?? []; visit.referrer = d.referrer ?? visit.referrer; } } catch {}
}
function closePage() {
  if (!current) return;
  visit.pages.push({ path: current.path, at: current.start, ms: Date.now() - current.start });
  current = null;
}
let lastSent = 0;
function flush(e?: Event) {
  // One batched beacon: when the page closes, or at most every 10 minutes when the tab is hidden. Never in dev.
  if (process.env.NODE_ENV !== 'production') return;
  if (e?.type !== 'pagehide' && Date.now() - lastSent < 600_000) return;
  const resume = current?.path;
  closePage();
  const body = JSON.stringify({ id: visit.id, vid: visit.vid, referrer: visit.referrer, pages: visit.pages.slice(-200), clicks: visit.clicks.slice(-300) });
  try { sessionStorage.setItem('ve_visit_data', JSON.stringify({ pages: visit.pages.slice(-200), clicks: visit.clicks.slice(-300), referrer: visit.referrer })); } catch {}
  if (body !== visit.sent && visit.pages.length) { navigator.sendBeacon?.('/api/t', new Blob([body], { type: 'application/json' })); visit.sent = body; lastSent = Date.now(); }
  if (resume && document.visibilityState === 'visible') current = { path: resume, start: Date.now() };
}

export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    ids();
    closePage();
    current = { path, start: Date.now() };
  }, [path]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest('a[href],button');
      if (!el) return;
      const target = el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? '' : el.getAttribute('aria-label') || el.textContent || '';
      visit.clicks.push({ path: location.pathname, target: target.trim().replace(/\s+/g, ' ').slice(0, 80), at: Date.now() });
    };
    const onHide = (e: Event) => { if (document.visibilityState === 'hidden') flush(e); else if (!current) current = { path: location.pathname, start: Date.now() }; };
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); };
  }, []);
  return null;
}
