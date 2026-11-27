import 'server-only';
import { listPaths, readFileStream, readJson, removePath, writeJson } from '@/lib/admin/store';

// The admin inbox. Mail to the domain arrives through Cloudflare Email Routing → the site's Worker (cf-worker.js, `email`
// handler), which saves the raw message privately (site/mail/raw/<id>.eml) with a small summary (site/mail/inbox/<id>.json)
// and still forwards a copy to the owner's normal mailbox. Ids start with a countdown number so the newest list first.
// Messages are opened (parsed) in the owner's browser, so a big email never costs the server anything.

export interface MailMeta {
  id: string;
  /** Envelope sender and the From header as sent. */
  from: string;
  fromHeader?: string;
  to: string;
  subject: string;
  date: string;
  messageId?: string;
  size: number;
  read: boolean;
  at: string;
  forwarded?: string[];
  forwardError?: string;
}

export interface SentMeta { id: string; to: string; from: string; subject: string; text: string; inReplyTo?: string; at: string }

const ID = /^[0-9]{13}-[a-z0-9]{4,12}$/;
export const isMailId = (id: string) => ID.test(id);
const metaPath = (id: string) => `site/mail/inbox/${id}.json`;
export const rawPath = (id: string) => `site/mail/raw/${id}.eml`;

export const newMailId = () => `${String(9_999_999_999_999 - Date.now()).padStart(13, '0')}-${Math.random().toString(36).slice(2, 10)}`;

export async function listMail(limit = 200): Promise<MailMeta[]> {
  const paths = await listPaths('site/mail/inbox/', limit);
  return (await Promise.all(paths.map((p) => readJson<MailMeta>(p)))).filter((m): m is MailMeta => Boolean(m));
}

export async function listSent(limit = 200): Promise<SentMeta[]> {
  const paths = await listPaths('site/mail/sent/', limit);
  return (await Promise.all(paths.map((p) => readJson<SentMeta>(p)))).filter((m): m is SentMeta => Boolean(m));
}

export const getMail = (id: string) => (isMailId(id) ? readJson<MailMeta>(metaPath(id)) : Promise.resolve(null));
export const rawMail = (id: string) => (isMailId(id) ? readFileStream(rawPath(id)) : Promise.resolve(null));

export async function setRead(id: string, read: boolean) {
  const m = await getMail(id);
  if (m && m.read !== read) await writeJson(metaPath(id), { ...m, read });
}

export async function deleteMail(id: string) {
  if (!isMailId(id)) return;
  await removePath([metaPath(id), rawPath(id)]).catch(() => {});
}

export const saveSent = (s: SentMeta) => writeJson(`site/mail/sent/${s.id}.json`, s);

/** "=?UTF-8?B?...?=" / "=?utf-8?Q?...?=" header words → plain text. */
export function decodeHeader(v: string): string {
  return (v ?? '').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_, cs: string, enc: string, data: string) => {
    try {
      const bytes = enc.toUpperCase() === 'B'
        ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        : Uint8Array.from(data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
      return new TextDecoder(cs.toLowerCase() === 'utf8' ? 'utf-8' : cs).decode(bytes);
    } catch {
      return data;
    }
  });
}

/** "Jane Doe <jane@x.com>" → { name, email }. */
export function splitAddress(v: string): { name: string; email: string } {
  const s = decodeHeader(v ?? '');
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(s);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: s.trim() };
}
