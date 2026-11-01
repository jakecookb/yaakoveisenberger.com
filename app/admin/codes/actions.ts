'use server';

import { revalidatePath } from 'next/cache';
import { generateCode, listCodes, listUses, MIN_CODE, newCode, normaliseCode, saveCodes } from '@/lib/access/codes';
import { updateRequest } from '@/lib/access/visitor';
import { requireAdmin } from '@/lib/admin/session';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export interface CodeFormState { ok?: boolean; error?: string; created?: string }

/** Makes a code. Left blank, a random one is generated. */
export async function createCodeAction(_prev: CodeFormState, form: FormData): Promise<CodeFormState> {
  await requireAdmin();
  const label = String(form.get('label') ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  const typed = String(form.get('code') ?? '').trim().slice(0, 40);
  const code = typed || generateCode();
  if (label.length < 2) return { error: 'Say who the code is for (at least 2 characters).' };
  if (normaliseCode(code).length < MIN_CODE) return { error: `Codes need at least ${MIN_CODE} letters or numbers.` };
  if (code.includes('@')) return { error: 'A code can’t contain @ (it would look like an email).' };
  const lockable = new Set(resolveCards(await loadSettings(), { includeHidden: true }).filter((c) => c.lockable).map((c) => c.id));
  const picked = form.getAll('boxes').map(String).filter((b) => lockable.has(b));
  const boxes = form.get('all') === 'yes' || picked.length === 0 ? '*' : picked;
  const codes = await listCodes();
  const made = newCode(label, code, boxes);
  if (codes.some((c) => c.hash === made.hash)) return { error: 'That code already exists — pick another.' };
  await saveCodes([made, ...codes]);
  revalidatePath('/admin/codes');
  return { ok: true, created: code };
}

/** Turns a code off (nobody new can use it; people who already got in keep their access) or back on. */
export async function toggleCodeAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  const codes = await listCodes();
  await saveCodes(codes.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  revalidatePath('/admin/codes');
}

/** Deletes a code. With "lockout", everyone who got in with it loses the boxes it opened for them. */
export async function deleteCodeAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  if (form.get('lockout') === 'yes') {
    for (const u of (await listUses(1000)).filter((x) => x.codeId === id)) {
      await updateRequest(u.recordId, (r) => {
        if (!r.codeGranted?.includes(u.box)) return; // they were also approved the normal way: keep it
        r.granted = r.granted.filter((c) => c !== u.box);
        r.codeGranted = r.codeGranted.filter((c) => c !== u.box);
      });
    }
  }
  await saveCodes((await listCodes()).filter((c) => c.id !== id));
  revalidatePath('/admin/codes');
  revalidatePath('/admin/access');
}
