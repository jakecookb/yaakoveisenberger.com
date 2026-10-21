// Shared by server pages and client components (no 'use client'), so both can lay out news cards the same way.
/** News cards: one full-width card per line on phones (under 768px), two then three columns on larger screens. */
export const NEWS_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3';

/** Kept for callers; with one card per line on phones there's never a lone card to hide. */
export const phoneOrphan = (_i: number, _count: number, _featured: boolean) => '';
