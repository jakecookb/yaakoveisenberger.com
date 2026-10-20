import Image from 'next/image';
import Link from 'next/link';
import { LoginTab } from './login-tab';
import wordmark from '@/public/images/home/wordmark-white.png';

const NAV = [
  { href: '/video', label: 'Video', desktopOnly: true },
  { href: '/cookbook', label: 'Cookbook', external: true, desktopOnly: true },
  { href: '/fund', label: 'Fundraising' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Yaakov Eisenberger — home">
          <Image src={wordmark} alt="Yaakov Eisenberger" className="h-2 w-auto sm:h-3" priority />
        </Link>
        <nav className="flex items-center text-[13px] sm:gap-2 sm:text-sm" aria-label="Main">
          {NAV.map((item) => {
            const className = `rounded-lg px-1.5 py-1.5 text-neutral-300 transition hover:bg-white/5 hover:text-white sm:px-3 ${item.desktopOnly ? 'hidden sm:block' : ''}`;
            // Cookbook is a separate app served under /cookbook, so it needs a full page load.
            return item.external ? (
              <a key={item.href} href={item.href} className={className}>{item.label}</a>
            ) : (
              <Link key={item.href} href={item.href} className={className}>{item.label}</Link>
            );
          })}
          <LoginTab />
        </nav>
      </div>
    </header>
  );
}
