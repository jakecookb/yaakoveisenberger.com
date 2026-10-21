import Image from 'next/image';
import wordmark from '@/public/images/home/wordmark-white.png';
import { site } from '@/lib/site/content';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6">
        <Image src={wordmark} alt="Yaakov Eisenberger" className="h-3 w-auto opacity-90" />
        <p className="text-sm text-neutral-400">
          <a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a>
          <span className="mx-2 text-neutral-600">·</span>
          <a href={site.phoneHref} className="hover:text-white">{site.phone}</a>
        </p>
        <p className="text-xs text-neutral-500">
          © {site.name}
        </p>
      </div>
    </footer>
  );
}
