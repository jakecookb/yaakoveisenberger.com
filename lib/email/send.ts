import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Sends email through Resend's HTTP API (free tier: 3,000 a month; the domain is already verified there).
// Set RESEND_API_KEY (and optionally EMAIL_FROM). Without a key nothing is sent; for local testing,
// EMAIL_OUTBOX_DIR saves each email as a file instead.

const FROM = process.env.EMAIL_FROM || 'Yaakov Eisenberger <access@yaakoveisenberger.com>';

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_OUTBOX_DIR);

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(mail: Email): Promise<boolean> {
  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (!process.env.RESEND_API_KEY && outbox) {
    await mkdir(outbox, { recursive: true });
    const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]+/gi, '_')}`;
    await writeFile(path.join(outbox, `${name}.json`), JSON.stringify({ from: FROM, ...mail }, null, 2));
    await writeFile(path.join(outbox, `${name}.html`), mail.html);
    return true;
  }
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('Email failed', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('Email failed', e);
    return false;
  }
}
