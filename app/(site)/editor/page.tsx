import { PhotoSuite } from '@/components/photo/photo-suite';

export const metadata = { title: 'AI Photo Suite', description: 'Free pro photo editor with AI background removal, auto-enhance, color grades, curves and more — all in your browser.' };

export default function EditorPage() {
  return (
    <section>
      <div className="mx-auto max-w-[96rem] px-3 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-4">
            <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#fda4af]">AI Photo Suite</h1>
          </div>
          <p className="text-xs text-neutral-500">Private: photos never leave your device.</p>
        </div>
        <PhotoSuite />
      </div>
    </section>
  );
}
