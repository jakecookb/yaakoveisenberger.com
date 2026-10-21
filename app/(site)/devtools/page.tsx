import { SquareTerminal } from 'lucide-react';
import { DevTools } from '@/components/devtools/devtools';

export const metadata = { title: 'Developer Tools', description: 'JSON → TypeScript, a glassmorphism style builder, a Git cheat sheet and Base64/URL encoders.' };

export default function Page() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#2dd4bf' }}><SquareTerminal className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Developer Tools</h1>
            <p className="mt-1 text-neutral-400">JSON → TypeScript, a glassmorphism style builder, a Git cheat sheet and Base64/URL encoders.</p>
          </div>
        </div>
        <div className="mt-8">
          <DevTools />
        </div>
      </div>
    </section>
  );
}
