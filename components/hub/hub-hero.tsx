import Image from 'next/image';
import { HeroLogo } from './hero-logo';
import logo from '@/public/images/home/logo.png';
import wordmark from '@/public/images/home/wordmark-white.png';

export function HubHero({ tagline, logoSrc }: { tagline: string; logoSrc?: string }) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(200,169,106,0.22),transparent_70%),radial-gradient(600px_300px_at_85%_20%,rgba(167,139,250,0.08),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-12 pt-16 text-center sm:px-6 sm:pb-16 sm:pt-24">
        <HeroLogo logo={logo} customSrc={logoSrc} />
        <h1 className="mt-6 sm:mt-8">
          <Image src={wordmark} alt="Yaakov Eisenberger" priority className="mx-auto h-4 w-auto sm:h-6" />
        </h1>
        <p className="mt-5 max-w-md text-balance text-neutral-400">{tagline}</p>
      </div>
    </section>
  );
}
