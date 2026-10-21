// Shared by server pages and client components (no 'use client'), so both can lay out news cards the same way.
/** Grid for news cards: two per row on phones, three on large screens. */
export const NEWS_GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3';

/** On a two-column phone grid, hide a last card that would sit alone on its row. */
export const phoneOrphan = (i: number, count: number, featured: boolean) => ((featured ? count - 1 : count) % 2 === 1 && i === count - 1 ? 'max-sm:hidden' : '');
