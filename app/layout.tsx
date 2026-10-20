import type { Metadata } from 'next';
import './globals.css';

// Stand-in root layout. In your real site keep your existing app/layout.tsx —
// the /fund module only needs its own app/fund/layout.tsx.
export const metadata: Metadata = {
  title: 'Yaakov Eisenberger',
  description: 'yaakoveisenberger.com',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
