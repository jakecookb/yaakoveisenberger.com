import type { StaticImageData } from 'next/image';
import memoriesOfShmuel from '@/public/images/home/memories-of-shmuel.jpg';
import mordechaiShapiroIntro from '@/public/images/home/mordechai-shapiro-intro.jpg';
import machanehRetzufos from '@/public/images/home/machaneh-retzufos-2025.jpg';

// Everything shown on the home page lives here. To add a project or video, add an
// entry to the matching list — no other code changes needed.

export const site = {
  name: 'Yaakov Eisenberger',
  email: 'Info@YaakovEisenberger.com',
  phone: '(732) 569-7959',
  phoneHref: 'tel:+17325697959',
};

export interface FeaturedWork {
  title: string;
  image: StaticImageData;
  href: string; // where the card opens (currently Google Drive videos)
  layout?: 'wide' | 'tall';
}

export const featuredWork: FeaturedWork[] = [
  {
    title: 'Memories of Shmuel A"H',
    image: memoriesOfShmuel,
    href: 'https://drive.google.com/file/d/1W-5GEaTCvuydxc1Dne5Zsa1Nn2sQNvmk/view?usp=drivesdk',
    layout: 'wide',
  },
  {
    title: 'Machaneh Retzufos 2025',
    image: machanehRetzufos,
    href: 'https://drive.google.com/file/d/1W5hfAM7Yii3_3KbTYrMkhanUzGnUpHV1/view?usp=drive_link',
    layout: 'tall',
  },
  {
    title: 'Mordechai Shapiro Intro',
    image: mordechaiShapiroIntro,
    href: 'https://drive.google.com/file/d/1LIb7P8wDwpRT5BvUmkxWdm_4qgmxg6NM/view?usp=drive_link',
    layout: 'wide',
  },
];

export interface Video {
  youtubeId: string;
  title: string;
  description?: string;
}

export const theZoneVideos: Video[] = [
  { youtubeId: 'nWQmgyE0LuQ', title: '2023 Highlights! | Boys Division' },
  { youtubeId: 'YKRXaLuetcU', title: 'BORN FOR THIS 🔥 | Week 3 | Session B | Boys Division' },
  { youtubeId: 'ee_fHQ97PN0', title: 'WEEK 2 @TheZone! | Session B | Boys Division' },
  { youtubeId: 'f39Q2BaAgFQ', title: 'WEEK 1 AT THEZONE! | Session B | Boys Division 2023' },
  { youtubeId: 'OhJ4Y50HyIg', title: "What's their secret? | Tisha B'av Inspiration Presented by Oorah's TheZone | 2023" },
  {
    youtubeId: 'CSJ-CraG72E',
    title: "Year of Tears | TheZone Tisha B'av Presentation 5784",
    description: 'Written and produced for TheZone campers, this inspiring and educational video brings new meaning to the day.',
  },
];
