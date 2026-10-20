import type { Metadata } from 'next';
import './globals.css';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yaakoveisenberger.com').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Yaakov Eisenberger', template: '%s · Yaakov Eisenberger' },
  description: 'Videos, projects and fundraising campaigns by Yaakov Eisenberger.',
  openGraph: {
    title: 'Yaakov Eisenberger',
    description: 'Videos, projects and fundraising campaigns by Yaakov Eisenberger.',
    url: siteUrl,
    siteName: 'Yaakov Eisenberger',
    images: [{ url: '/images/home/memories-of-shmuel.jpg', width: 1280, height: 718 }],
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
