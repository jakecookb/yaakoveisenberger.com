import type { CarSource } from '@/lib/cars/types';

// Public RSS feeds from phone and gadget news sites. We show a headline, a short summary, the feed's thumbnail and a link to
// the original article. To add a source, add a line.
export const SOURCES: CarSource[] = [
  { id: 'androidauthority', name: 'Android Authority', feed: 'https://www.androidauthority.com/feed/', home: 'https://www.androidauthority.com' },
  { id: 'gsmarena', name: 'GSMArena', feed: 'https://www.gsmarena.com/rss-news-reviews.php3', home: 'https://www.gsmarena.com' },
  { id: '9to5google', name: '9to5Google', feed: 'https://9to5google.com/feed/', home: 'https://9to5google.com' },
  { id: 'androidheadlines', name: 'Android Headlines', feed: 'https://www.androidheadlines.com/feed', home: 'https://www.androidheadlines.com' },
  { id: '9to5mac', name: '9to5Mac', feed: 'https://9to5mac.com/feed/', home: 'https://9to5mac.com' },
  { id: 'macrumors', name: 'MacRumors', feed: 'https://feeds.macrumors.com/MacRumors-All', home: 'https://www.macrumors.com' },
  { id: 'verge', name: 'The Verge', feed: 'https://www.theverge.com/rss/index.xml', home: 'https://www.theverge.com' },
];
