// Shared by server pages and client components (no 'use client' / 'server-only'): how a story's link becomes its page on this site.

export type NewsTopic = 'cars' | 'tech' | 'weapons';

/**
 * A story's address carries its original link (base64url), so a story page can go straight to the publisher without first
 * searching every feed for it. The page only ever fetches links on its own topic's publishers (see loadStory).
 */
export function slugOf(url: string): string {
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A short hash of a link, for cache file names. */
export function hashOf(url: string): string {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < url.length; i++) { const c = url.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** The original link inside a story address, or undefined if it isn't one. */
export function urlOf(slug: string): string | undefined {
  try {
    if (!/^[A-Za-z0-9_-]{8,1500}$/.test(slug)) return undefined;
    const url = new URL(atob(slug.replace(/-/g, '+').replace(/_/g, '/')));
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Google News links are only a redirect to the publisher (no text to summarise), so those stay as outbound links. */
export const isRedirect = (url: string) => /(^|\.)news\.google\.com$/i.test(new URL(url).hostname);

/** Where a news card goes: its summary page here, or the original when there's nothing to summarise. */
export const articleHref = (topic: NewsTopic, url: string) => (isRedirect(url) ? url : `/${topic}/story/${slugOf(url)}`);
