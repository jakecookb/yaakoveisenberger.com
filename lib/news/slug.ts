// Shared by server pages and client components (no 'use client' / 'server-only'): how a story's link becomes its page on this site.

export type NewsTopic = 'cars' | 'tech' | 'weapons';

/** A short, stable id for a story, worked out from its original link (two small hashes, so a collision is very unlikely). */
export function slugOf(url: string): string {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b, 33) ^ c;
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** Google News links are only a redirect to the publisher (no text to summarise), so those stay as outbound links. */
export const isRedirect = (url: string) => /(^|\.)news\.google\.com$/i.test(new URL(url).hostname);

/** Where a news card goes: its summary page here, or the original when there's nothing to summarise. */
export const articleHref = (topic: NewsTopic, url: string) => (isRedirect(url) ? url : `/${topic}/story/${slugOf(url)}`);
