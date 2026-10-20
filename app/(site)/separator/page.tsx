import { AudioLines } from 'lucide-react';
import { SeparatorTool } from '@/components/separator/separator-tool';

export const metadata = {
  title: 'Audio Separator',
  description: 'Split any song into vocals and instrumental, free, right in your browser. Your music never leaves your device.',
};

export default function SeparatorPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[#a3e635] text-neutral-950 shadow-xl"><AudioLines className="size-8" strokeWidth={2.2} /></span>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Audio Separator</h1>
        <p className="mx-auto mt-3 max-w-xl text-neutral-400">Upload a song and get the vocals and the instrumental as two separate tracks. Free, no sign-up, and your music never leaves your device.</p>
      </div>
      <div className="mt-10"><SeparatorTool /></div>
    </section>
  );
}
