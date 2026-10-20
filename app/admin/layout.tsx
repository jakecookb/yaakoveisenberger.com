import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="site-dark min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">{children}</div>;
}
