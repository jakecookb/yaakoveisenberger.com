'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { renderQr } from '@/lib/qr/render';

const ACCENT = '#f472b6';

export function QrMaker() {
  const [text, setText] = useState('https://yaakoveisenberger.com');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const value = text.trim();

  useEffect(() => {
    const el = canvas.current;
    if (!el || !value) { setReady(false); setError(''); return; }
    let live = true;
    // Redraw as the person types (a short pause keeps long pastes smooth).
    const t = setTimeout(() => {
      renderQr(el, value).then((r) => {
        if (!live) return;
        setReady(r.ok);
        setError(r.ok ? '' : r.error);
      }).catch(() => live && (setReady(false), setError('Could not draw the code — please try again.')));
    }, 80);
    return () => { live = false; clearTimeout(t); };
  }, [value]);

  const download = () => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-yaakoveisenberger.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 md:grid-cols-2">
      <div className="order-2 md:order-1">
        <label htmlFor="qr-text" className="text-xs font-medium uppercase tracking-wider text-neutral-400">Link, text or data</label>
        <div className="relative mt-2">
          <textarea
            id="qr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={2000}
            spellCheck={false}
            placeholder="https://example.com"
            className="w-full resize-none rounded-3xl bg-neutral-900/70 p-5 pr-12 text-base text-white outline-none ring-1 ring-white/10 transition placeholder:text-neutral-600 focus:ring-2 focus:ring-[var(--accent)]"
            style={{ '--accent': ACCENT } as React.CSSProperties}
          />
          {text && (
            <button onClick={() => setText('')} aria-label="Clear" className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-500 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">Everything is made right here in your browser — nothing you type is sent or saved anywhere.</p>
        <button
          onClick={download}
          disabled={!ready}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-neutral-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8"
          style={{ background: ACCENT }}
        >
          <Download className="size-4" /> Download PNG
        </button>
      </div>

      <div className="order-1 md:order-2">
        <div className="relative mx-auto w-full max-w-sm">
          <canvas ref={canvas} width={1024} height={1152} aria-label="Your QR code" className={`w-full rounded-[2rem] shadow-[0_30px_80px_-30px_var(--accent)] transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ '--accent': ACCENT } as React.CSSProperties} />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-neutral-900/70 p-6 text-center text-sm text-neutral-400 ring-1 ring-white/10">
              {error || 'Type something to see your code.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
