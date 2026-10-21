import 'server-only';
import { siteUrl } from '@/lib/site/url';

// Branded HTML emails. Email clients ignore most modern CSS, so this is table layout with inline styles,
// dark colours that match the site, and a plain-text copy of every message.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const GOLD = '#c8a96a';

export function layout({ preheader, heading, body, button, footnote }: { preheader: string; heading: string; body: string; button?: { label: string; href: string }; footnote?: string }) {
  const base = siteUrl();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td align="center" style="padding-bottom:28px;">
      <a href="${base}" style="text-decoration:none;"><img src="${base}/images/home/logo-hd.png" width="72" height="72" alt="Yaakov Eisenberger" style="display:block;border:0;border-radius:18px;"></a>
    </td></tr>
    <tr><td style="background:#171717;border:1px solid #2a2a2a;border-radius:24px;padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:600;">yaakoveisenberger.com</p>
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#ffffff;font-weight:600;">${esc(heading)}</h1>
      <div style="font-size:15px;line-height:1.65;color:#a3a3a3;">${body}</div>
      ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 8px;"><tr><td style="border-radius:999px;background:${GOLD};">
        <a href="${esc(button.href)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:999px;">${esc(button.label)}</a>
      </td></tr></table>
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#737373;">Button not working? Paste this link into your browser:<br><a href="${esc(button.href)}" style="color:${GOLD};word-break:break-all;">${esc(button.href)}</a></p>` : ''}
    </td></tr>
    <tr><td align="center" style="padding-top:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#525252;">
      ${footnote ? `${esc(footnote)}<br>` : ''}© Yaakov Eisenberger · <a href="${base}" style="color:#737373;">yaakoveisenberger.com</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function signInEmail({ name, link, box, hours }: { name: string; link: string; box?: string; hours: number }) {
  const first = name.split(' ')[0];
  const what = box ? `<b style="color:#e5e5e5;">${esc(box)}</b>` : 'the private pages';
  return {
    subject: 'Your sign-in link for yaakoveisenberger.com',
    html: layout({
      preheader: `Sign in to see ${box ?? 'private pages'} on yaakoveisenberger.com`,
      heading: `Hi ${first}, here's your sign-in link`,
      body: `<p style="margin:0 0 14px;">Thanks for your request to see ${what}. Use the button below to sign in on any device — once your access is approved, it opens automatically.</p><p style="margin:0;">This link works for ${hours} hours.</p>`,
      button: { label: 'Sign in', href: link },
      footnote: "Didn't ask for this? You can ignore this email.",
    }),
    text: `Hi ${first},\n\nThanks for your request to see ${box ?? 'the private pages'} on yaakoveisenberger.com.\nSign in on any device with this link (valid for ${hours} hours):\n\n${link}\n\nOnce your access is approved, it opens automatically.\n\nDidn't ask for this? You can ignore this email.\n`,
  };
}

export function approvedEmail({ name, link, box }: { name: string; link: string; box: string }) {
  const first = name.split(' ')[0];
  return {
    subject: `You're approved: ${box}`,
    html: layout({
      preheader: `Your access to ${box} was approved`,
      heading: `You're in, ${first}`,
      body: `<p style="margin:0;">Your request to see <b style="color:#e5e5e5;">${esc(box)}</b> was approved. Open it with the button below — it signs you in on whatever device you use.</p>`,
      button: { label: `Open ${box}`, href: link },
    }),
    text: `You're in, ${first}!\n\nYour request to see ${box} on yaakoveisenberger.com was approved. Open it here:\n\n${link}\n`,
  };
}

const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#737373;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;color:#e5e5e5;">${esc(v)}</td></tr>`;

export interface QuoteInfo { board: string; name: string; email: string; phone: string; date: string; guests: string; message: string }

export function quoteToOwner(q: QuoteInfo) {
  const rows = [['Board', q.board], ['Name', q.name], ['Email', q.email], ['Phone', q.phone], ['Event date', q.date || '—'], ['Guests', q.guests || '—'], ['Details', q.message || '—']];
  return {
    subject: `New quote request: ${q.board} — ${q.name}`,
    html: layout({ preheader: `${q.name} asked for a ${q.board} quote`, heading: `New ${q.board} quote request`, body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.map(([k, v]) => row(k, v)).join('')}</table><p style="margin:16px 0 0;">Just hit reply to answer ${esc(q.name.split(' ')[0])} directly.</p>` }),
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nReply to this email to answer the customer directly.',
  };
}

export function quoteToCustomer(q: QuoteInfo) {
  return {
    subject: `We got your ${q.board} request`,
    html: layout({ preheader: 'Thanks — your quote request is in', heading: `Thanks, ${q.name.split(' ')[0]}!`, body: `<p style="margin:0 0 14px;">Your ${esc(q.board.toLowerCase())} quote request is in. I’ll get back to you shortly with pricing and availability${q.date ? ` for ${esc(q.date)}` : ''}.</p><p style="margin:0;">Anything to add? Just reply to this email.</p>`, footnote: 'You’re receiving this because you requested a quote on yaakoveisenberger.com.' }),
    text: `Thanks, ${q.name.split(' ')[0]}! Your ${q.board} quote request is in — I'll reply shortly with pricing and availability. Anything to add? Just reply to this email.`,
  };
}

export function welcomeSubscriber(topics: string, unsubscribe: string) {
  return {
    subject: 'You’re subscribed to yaakoveisenberger.com',
    html: layout({ preheader: 'Updates are on the way', heading: 'You’re on the list', body: `<p style="margin:0 0 14px;">Thanks for subscribing. You’ll get an email when there’s something new about: <b style="color:#e5e5e5;">${esc(topics)}</b>.</p><p style="margin:0;font-size:13px;">Changed your mind? <a href="${esc(unsubscribe)}" style="color:#c8a96a;">Unsubscribe</a> any time.</p>` }),
    text: `Thanks for subscribing to yaakoveisenberger.com updates about: ${topics}.\n\nUnsubscribe any time: ${unsubscribe}`,
  };
}

/** An announcement: the owner's plain text, paragraphs kept, links clickable. */
export function broadcastEmail(subject: string, body: string, unsubscribe: string, link?: string) {
  const html = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c8a96a;">$1</a>')}</p>`).join('');
  return {
    subject,
    html: layout({ preheader: body.slice(0, 90), heading: subject, body: `${html}<p style="margin:18px 0 0;font-size:12px;"><a href="${esc(unsubscribe)}" style="color:#737373;">Unsubscribe</a></p>`, button: link ? { label: 'Take a look', href: link } : undefined }),
    text: `${body}\n\n${link ? `${link}\n\n` : ''}Unsubscribe: ${unsubscribe}`,
  };
}
