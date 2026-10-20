import 'server-only';

// Sends the one-time sign-in code to the owner's WhatsApp through Twilio's WhatsApp API.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. +14155238886 or your approved sender),
// optional TWILIO_CONTENT_SID (an approved WhatsApp *authentication* template with one variable, the code —
// required by WhatsApp outside the 24-hour window). TWILIO_API_BASE may only be overridden outside production (tests).

const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
const token = process.env.TWILIO_AUTH_TOKEN ?? '';
const from = process.env.TWILIO_WHATSAPP_FROM ?? '';
const contentSid = process.env.TWILIO_CONTENT_SID ?? '';
const base = (process.env.NODE_ENV !== 'production' && process.env.TWILIO_API_BASE) || 'https://api.twilio.com';

export const adminPhone = (process.env.ADMIN_2FA_PHONE ?? '').trim();
export const isWhatsAppConfigured = Boolean(sid && token && from);
/** Two-step verification is on as soon as an admin phone is set; it fails closed if sending isn't configured. */
export const isTwoFactorRequired = Boolean(adminPhone);

export async function sendWhatsAppCode(code: string): Promise<boolean> {
  if (!isWhatsAppConfigured || !adminPhone) return false;
  const form = new URLSearchParams({ To: `whatsapp:${adminPhone}`, From: `whatsapp:${from.replace(/^whatsapp:/, '')}` });
  if (contentSid) {
    form.set('ContentSid', contentSid);
    form.set('ContentVariables', JSON.stringify({ '1': code }));
  } else {
    form.set('Body', `Your Yaakov Eisenberger admin code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.`);
  }
  try {
    const res = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
