import type { CarSource } from './types';

// Public RSS feeds from car publications (the kind meant for syndication). We show a headline, a short excerpt, the
// thumbnail the feed provides and a link to the original article, never the article itself. To add a source, add a line.
export const SOURCES: CarSource[] = [
  { id: 'carscoops', name: 'Carscoops', feed: 'https://www.carscoops.com/feed/', home: 'https://www.carscoops.com' },
  { id: 'motor1', name: 'Motor1', feed: 'https://www.motor1.com/rss/articles/all/', home: 'https://www.motor1.com' },
  { id: 'caranddriver', name: 'Car and Driver', feed: 'https://www.caranddriver.com/rss/all.xml/', home: 'https://www.caranddriver.com' },
  { id: 'roadandtrack', name: 'Road & Track', feed: 'https://www.roadandtrack.com/rss/all.xml/', home: 'https://www.roadandtrack.com' },
  { id: 'jalopnik', name: 'Jalopnik', feed: 'https://jalopnik.com/rss', home: 'https://jalopnik.com' },
  { id: 'autocar', name: 'Autocar', feed: 'https://www.autocar.co.uk/rss', home: 'https://www.autocar.co.uk' },
];
