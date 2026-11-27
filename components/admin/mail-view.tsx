'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Image as ImageIcon, MailOpen, Paperclip, Reply, Send, Trash2 } from 'lucide-react';
import type { Email } from 'postal-mime';
import { deleteMailAction, markReadAction, replyAction } from '@/app/admin/inbox/actions';
import type { MailMeta } from '@/lib/mail/store';

const btn = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition disabled:opacity-40';
const neutral = `${btn} bg-white/5 text-neutral-200 ring-1 ring-white/10 hover:bg-white/10`;

type Content = string | ArrayBuffer | Uint8Array;
/** An attachment's content as plain bytes (a fresh copy). */
const bytesOf = (c: Content) => (typeof c === 'string' ? new TextEncoder().encode(c) : new Uint8Array(c instanceof Uint8Array ? c : new Uint8Array(c)));
const toB64 = (c: Content) => {
  const bytes = bytesOf(c);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const who = (a?: { name?: string; address?: string }) => (a ? (a.name ? `${a.name} <${a.address}>` : a.address ?? '') : '');

/**
 * One email, opened here in the browser (the raw message is parsed locally). The body is shown in a locked-down frame:
 * no scripts, and pictures from the internet stay blocked until you choose to show them (they can tell the sender you opened it).
 */
export function MailView({ meta }: { meta: MailMeta }) {
  const [mail, setMail] = useState<Email | null>(null);
  const [failed, setFailed] = useState(false);
  const [images, setImages] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/mail/${meta.id}`);
        if (!res.ok) throw new Error();
        const { default: PostalMime } = await import('postal-mime');
        const parsed = await PostalMime.parse(await res.arrayBuffer());
        if (live) setMail(parsed);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [meta.id]);

  const files = useMemo(() => (mail?.attachments ?? []).filter((a) => a.disposition !== 'inline' || !a.contentId), [mail]);
  const urls = useMemo(() => files.map((a) => URL.createObjectURL(new Blob([bytesOf(a.content)], { type: a.mimeType || 'application/octet-stream' }))), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const doc = useMemo(() => {
    if (!mail) return '';
    let body = mail.html || `<pre style="white-space:pre-wrap;font:15px/1.55 system-ui,sans-serif;margin:0">${esc(mail.text ?? '')}</pre>`;
    // Pictures sent inside the email ("cid:" links) are shown from the message itself.
    for (const a of mail.attachments ?? []) {
      if (!a.contentId) continue;
      const cid = a.contentId.replace(/^<|>$/g, '');
      body = body.split(`cid:${cid}`).join(`data:${a.mimeType};base64,${toB64(a.content)}`);
    }
    const csp = `default-src 'none'; style-src 'unsafe-inline' ${images ? 'https:' : ''}; img-src data: ${images ? 'https: http:' : ''}; font-src data: ${images ? 'https:' : ''}`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:16px;font:15px/1.55 system-ui,sans-serif;color:#111;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`;
  }, [mail, images]);
  const hasRemote = Boolean(mail?.html && /<img[^>]+src=["']?https?:/i.test(mail.html));

  const send = () =>
    start(async () => {
      const res = await replyAction({ id: meta.id, replyTo: mail?.replyTo?.[0]?.address, body: reply, quote: (mail?.text ?? '').slice(0, 20_000) });
      if (res.ok) { setReply(''); setReplying(false); setNote({ ok: true, text: 'Reply sent.' }); }
      else setNote({ ok: false, text: res.error ?? 'Could not send.' });
    });

  const subject = mail?.subject ?? meta.subject;
  return (
    <article className="mt-4">
      <h1 className="text-xl font-semibold text-white sm:text-2xl">{subject || '(no subject)'}</h1>
      <div className="mt-3 rounded-2xl bg-neutral-900/60 p-4 text-sm ring-1 ring-white/10">
        <p className="text-neutral-200"><span className="text-neutral-500">From </span>{mail ? who(mail.from) : meta.fromHeader || meta.from}</p>
        <p className="text-neutral-400"><span className="text-neutral-500">To </span>{mail ? (mail.to ?? []).map(who).join(', ') || meta.to : meta.to}</p>
        {mail?.cc?.length ? <p className="text-neutral-400"><span className="text-neutral-500">Cc </span>{mail.cc.map(who).join(', ')}</p> : null}
        <p className="text-neutral-500">{new Date(mail?.date || meta.at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${btn} bg-[#c8a96a] text-neutral-950 hover:bg-[#d8bc82]`} onClick={() => setReplying(true)} disabled={!mail}><Reply className="size-3.5" /> Reply</button>
        {hasRemote && !images && <button type="button" className={neutral} onClick={() => setImages(true)}><ImageIcon className="size-3.5" /> Show pictures</button>}
        <button type="button" className={neutral} disabled={busy} onClick={() => start(async () => { await markReadAction(meta.id, false); router.push('/admin/inbox'); })}><MailOpen className="size-3.5" /> Mark unread</button>
        <a className={neutral} href={`/api/admin/mail/${meta.id}`}><Download className="size-3.5" /> Original</a>
        <button type="button" className={`${btn} bg-red-400/10 text-red-300 ring-1 ring-red-400/20 hover:bg-red-400/20`} disabled={busy} onClick={() => confirm('Delete this email from the admin inbox? (The copy in Gmail stays.)') && start(() => deleteMailAction(meta.id))}><Trash2 className="size-3.5" /> Delete</button>
        {note && <span role="status" className={`self-center text-sm ${note.ok ? 'text-emerald-300' : 'text-red-400'}`}>{note.text}</span>}
      </div>

      {replying && (
        <div className="mt-4 rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10">
          <p className="text-xs text-neutral-500">To {mail?.replyTo?.[0]?.address || mail?.from?.address} · from {meta.to}</p>
          <textarea autoFocus value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply…" className="mt-2 min-h-36 w-full rounded-xl bg-neutral-950 p-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-[#c8a96a]" />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy || !reply.trim()} onClick={send} className={`${btn} bg-[#c8a96a] text-neutral-950 hover:bg-[#d8bc82]`}><Send className="size-3.5" /> {busy ? 'Sending…' : 'Send reply'}</button>
            <button type="button" onClick={() => setReplying(false)} className={neutral}>Cancel</button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {files.map((a, i) => (
            <li key={i}><a href={urls[i]} download={a.filename || `attachment-${i + 1}`} className={neutral}><Paperclip className="size-3.5" /> <span className="max-w-48 truncate">{a.filename || `Attachment ${i + 1}`}</span> <span className="text-neutral-500">{size(bytesOf(a.content).byteLength)}</span></a></li>
          ))}
        </ul>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-white/10">
        {failed ? <p className="bg-neutral-900 p-6 text-sm text-red-300">This email couldn’t be opened. Use “Original” to download it.</p>
          : !mail ? <p className="bg-neutral-900 p-6 text-sm text-neutral-500">Opening…</p>
          : <iframe title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="h-[70vh] w-full" />}
      </div>
    </article>
  );
}
