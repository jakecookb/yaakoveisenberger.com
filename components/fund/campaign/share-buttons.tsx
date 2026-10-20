'use client';

import { useState } from 'react';
import { Check, Link2, Mail, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '../ui/cn';

export function ShareButtons({ url, title, className }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${title} — every gift is matched! Join me:`;
  const enc = encodeURIComponent;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };
  const native = async () => {
    if (navigator.share) await navigator.share({ title, text, url }).catch(() => {});
    else void copy();
  };
  const btn = 'inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50';
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <button onClick={copy} className={btn}>
        {copied ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />} {copied ? 'Copied' : 'Copy link'}
      </button>
      <a className={btn} href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" /> WhatsApp
      </a>
      <a className={btn} href={`mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`}>
        <Mail className="size-4" /> Email
      </a>
      <button onClick={native} className={btn}>
        <Share2 className="size-4" /> More
      </button>
    </div>
  );
}
