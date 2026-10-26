'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hashPassword, verifyPassword } from '@/lib/admin/password';
import { checkCode, startChallenge } from '@/lib/admin/otp';
import { isTwoFactorRequired } from '@/lib/admin/whatsapp';
import {
  checkCredentials, clientIp, CREDENTIAL_PATH, endAdminSession, isAdminConfigured, isAdminEmail, loginBlocked, recordLogin, requireAdmin, startAdminSession,
} from '@/lib/admin/session';
import { isBlobConfigured, readJson, removePath, writeJson } from '@/lib/admin/store';
import { deleteRequest, getRequest, signInToken, updateRequest } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { approvedEmail } from '@/lib/email/templates';
import { siteUrl } from '@/lib/site/url';
import { forgetSettingsMemo, loadSettings, PREVIOUS_PATH, SETTINGS_PATH } from '@/lib/site/load';
import { resolveCards, sanitizeSettings, settingsSchema } from '@/lib/site/settings';

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAdminConfigured) return { error: 'Admin login is not set up on this deployment yet.' };
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: 'Too many attempts. Try again in a few minutes.' };
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const ok = email.length < 200 && password.length < 500 && (await checkCredentials(email, password));
  recordLogin(ip, ok);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: 'Wrong email or password.' };
  }
  if (isTwoFactorRequired) {
    const sent = await startChallenge('login', email.trim().toLowerCase());
    if (sent !== 'sent') return { error: challengeError(sent) };
    redirect('/admin/login/verify');
  }
  await startAdminSession();
  redirect('/admin');
}

function challengeError(r: 'busy' | 'send-failed' | 'no-storage') {
  return r === 'busy'
    ? 'Too many codes requested. Wait 10 minutes and try again.'
    : r === 'no-storage'
      ? 'Storage is not connected, so a code can’t be created.'
      : 'Could not send the WhatsApp code. Check the WhatsApp settings and try again.';
}

/** Step 2 of sign-in: the code sent to WhatsApp. */
export async function verifyLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: 'Too many attempts. Try again in a few minutes.' };
  const res = await checkCode('login', String(formData.get('code') ?? ''));
  recordLogin(ip, res.ok);
  if (!res.ok) return { error: res.error };
  await startAdminSession();
  redirect('/admin');
}

/** "Forgot password": sends a code to the owner's WhatsApp (the answer never reveals whether the email matched). */
export async function forgotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAdminConfigured || !isTwoFactorRequired) return { error: 'Password reset by WhatsApp is not set up yet.' };
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: 'Too many attempts. Try again in a few minutes.' };
  recordLogin(ip, false); // every request counts toward the limit
  const email = String(formData.get('email') ?? '');
  if (isAdminEmail(email)) {
    const sent = await startChallenge('reset', email.trim().toLowerCase());
    if (sent === 'busy' || sent === 'no-storage') return { error: challengeError(sent) };
  }
  redirect('/admin/login/reset');
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = String(formData.get('next') ?? '');
  if (next.length < 10) return { error: 'New password must be at least 10 characters.' };
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: 'Too many attempts. Try again in a few minutes.' };
  const res = await checkCode('reset', String(formData.get('code') ?? ''));
  recordLogin(ip, false);
  if (!res.ok) return { error: res.error };
  await writeJson(CREDENTIAL_PATH, { hash: await hashPassword(next), updatedAt: new Date().toISOString() });
  await endAdminSession();
  redirect('/admin/login?changed=1');
}

export async function logoutAction() {
  await endAdminSession();
  redirect('/');
}

export async function saveSettings(input: unknown): Promise<FormState> {
  await requireAdmin();
  if (!isBlobConfigured) return { error: 'Storage is not connected to this deployment.' };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Some values are invalid: ' + parsed.error.issues.slice(0, 3).map((i) => i.path.join('.') + ' ' + i.message).join('; ') };
  const next = sanitizeSettings(parsed.data);
  const prev = await loadSettings();

  // Only photos this settings file already owns, or just-uploaded ones in the right folder, may be referenced.
  const kept = new Set(Object.values(next.photos).flat().map((p) => p.pathname));
  const submitted = Object.values(parsed.data.photos).flat().map((p) => p.pathname);
  const removed = [...Object.values(prev.photos).flat().map((p) => p.pathname), ...submitted].filter((p, i, a) => !kept.has(p) && a.indexOf(p) === i);
  if (prev.hero.logoPath && prev.hero.logoPath !== next.hero.logoPath) removed.push(prev.hero.logoPath);
  for (const [cat, photos] of Object.entries(next.photos)) {
    if (photos.some((p) => !p.pathname.startsWith(`photos/${cat}/`))) return { error: 'A photo is filed under the wrong category.' };
  }

  // Keep the version being replaced, so a bad save can be undone from the editor.
  const before = await readJson<unknown>(SETTINGS_PATH);
  if (before) await writeJson(PREVIOUS_PATH, before).catch(() => {});
  await writeJson(SETTINGS_PATH, next);
  forgetSettingsMemo();
  if (removed.length) await removePath(removed).catch(() => {});
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Brings back the version saved before the latest one (the latest becomes the new "previous", so it can be flipped back). */
export async function restorePrevious(): Promise<FormState & { settings?: unknown }> {
  await requireAdmin();
  const prev = settingsSchema.safeParse(await readJson<unknown>(PREVIOUS_PATH));
  if (!prev.success) return { error: 'There is no earlier version to restore.' };
  const current = await readJson<unknown>(SETTINGS_PATH);
  await writeJson(SETTINGS_PATH, sanitizeSettings(prev.data));
  if (current) await writeJson(PREVIOUS_PATH, current).catch(() => {});
  forgetSettingsMemo();
  revalidatePath('/', 'layout');
  return { ok: true, settings: sanitizeSettings(prev.data) };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  if (next.length < 10) return { error: 'New password must be at least 10 characters.' };
  if (!isBlobConfigured) return { error: 'Storage is not connected, so the password can only be changed in Vercel env vars.' };
  const saved = await readJson<{ hash?: string }>(CREDENTIAL_PATH);
  const hash = saved?.hash || process.env.ADMIN_PASSWORD_HASH || '';
  if (!(await verifyPassword(current, hash))) return { error: 'Current password is wrong.' };
  await writeJson(CREDENTIAL_PATH, { hash: await hashPassword(next), updatedAt: new Date().toISOString() });
  await endAdminSession(); // every session (including this one) is now invalid
  redirect('/admin/login?changed=1');
}

// ---- access requests ----

export async function approveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  const cat = String(formData.get('cat'));
  // Saved first; the email only goes out when this click actually granted something new,
  // so repeated clicks or refreshes never send it twice.
  const changed = await updateRequest(id, (r) => {
    if (cat === '*') r.all = true;
    else {
      if (!r.granted.includes(cat)) r.granted.push(cat);
      r.requested = r.requested.filter((c) => c !== cat);
      r.denied = r.denied.filter((c) => c !== cat);
      if (r.deniedAt) delete r.deniedAt[cat];
    }
    if (r.all) r.requested = [];
  });
  if (changed && (changed.all || changed.granted.includes(cat))) await emailApproval(id, cat);
  revalidatePath('/admin/access');
}

/** Lets the person know they're in, with a link that signs them in on any device. Best effort: approval stands either way. */
async function emailApproval(id: string, cat: string) {
  try {
    const rec = await getRequest(id);
    if (!rec?.email) return;
    const box = cat === '*' ? 'everything on the site' : resolveCards(await loadSettings(), { includeHidden: true }).find((c) => c.id === cat)?.title ?? 'your page';
    const link = `${siteUrl()}/access/verify?t=${await signInToken(rec, cat === '*' ? undefined : cat)}`;
    await sendEmail({ to: rec.email, ...approvedEmail({ name: rec.name, link, box }) });
  } catch {}
}

export async function denyAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  const cat = String(formData.get('cat'));
  await updateRequest(id, (r) => {
    r.requested = r.requested.filter((c) => c !== cat);
    if (!r.denied.includes(cat)) r.denied.push(cat);
    r.deniedAt = { ...r.deniedAt, [cat]: new Date().toISOString() };
  });
  revalidatePath('/admin/access');
}

export async function revokeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  const cat = String(formData.get('cat'));
  await updateRequest(id, (r) => {
    if (cat === '*') r.all = false;
    else { r.granted = r.granted.filter((c) => c !== cat); r.codeGranted = r.codeGranted?.filter((c) => c !== cat); }
  });
  revalidatePath('/admin/access');
}

export async function removeVisitorAction(formData: FormData) {
  await requireAdmin();
  await deleteRequest(String(formData.get('id')));
  revalidatePath('/admin/access');
}
