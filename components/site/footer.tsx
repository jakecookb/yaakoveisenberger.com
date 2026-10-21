import Image from 'next/image';
import wordmark from '@/public/images/home/wordmark-white.png';
import { site } from '@/lib/site/content';
import { SubscribeForm } from './subscribe-form';

const LEGAL: [string, string][] = [
  ['§ 1. INTELLECTUAL PROPERTY & OWNERSHIP', 'All proprietary code, stylesheets, scripts, visual assets, copy, typography, micro-interactions, and design frameworks published under YaakovEisenberger.com are the exclusive intellectual property of the operator. Standard statutory protection applies immediately upon deployment under international copyright protocols (WIPO Convention, Berne Convention, and Title 17 of the U.S. Code). Any unauthorized scraping, cloning, decompiling, or mechanical replication—whether by human agency or autonomous software bots—is strictly prohibited without prior written consent.'],
  ['§ 2. LIMITATION OF LIABILITY & OPERATIONAL DISCLAIMER', 'The content contained herein is provided on an "as-is" and "as-available" basis without representations or warranties of any kind, express or implied. Under no circumstances shall the operator be held liable for sudden bursts of inspiration, loss of productive work time spent exploring this platform, or minor emotional distress resulting from encountering functional, well-structured layouts.'],
  ['§ 3. TECHNICAL SPECIFICATIONS & SYSTEM REQ.', 'Optimized for modern viewport dimensions, webkit rendering engines, and high-DPI displays. Side effects of prolonged viewing may include enhanced aesthetic standards, sudden urges to upgrade monitor hardware, or an appreciation for clean UI. Server logs reserve the right to silently appreciate every successful HTTPS handshake.'],
  ['§ 4. APPLICABLE LAW & JURISDICTION', 'Any disputes arising from the use of this domain shall be governed under local jurisdiction, standard internet courtesy standards, and common sense. By remaining on this page, the user hereby waives all rights to claim this design was anything short of well-crafted.'],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-12 text-center sm:px-6">
        <SubscribeForm />
        <Image src={wordmark} alt="Yaakov Eisenberger" className="h-3 w-auto opacity-90" />
        <p className="text-sm text-neutral-400">
          <a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a>
          <span className="mx-2 text-neutral-600">·</span>
          <a href={site.phoneHref} className="hover:text-white">{site.phone}</a>
        </p>
        <div className="text-xs text-neutral-500">
          <p>© 2026 YaakovEisenberger.com. All Rights Reserved.</p>
          <p className="mt-1">Designed &amp; built with precision for the modern web.</p>
        </div>
        <details className="w-full max-w-3xl text-left">
          <summary className="cursor-pointer text-center font-mono text-[11px] tracking-wider text-neutral-500 hover:text-neutral-300">LEGAL NOTICE &amp; REGULATORY DISCLOSURES — DOC REF #8841-A</summary>
          <div className="mt-4 space-y-4 font-mono text-[11px] leading-relaxed text-neutral-500">
            {LEGAL.map(([h, t]) => <p key={h}><span className="block text-neutral-400">{h}</span>{t}</p>)}
            <p><span className="block text-neutral-400">PRIVACY</span>This site records visits (IP address, approximate location, referrer, pages and clicks) to understand how it’s used. Emails you give us are used only for what you asked for.</p>
          </div>
        </details>
      </div>
    </footer>
  );
}
