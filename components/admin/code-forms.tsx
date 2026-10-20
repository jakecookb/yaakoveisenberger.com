'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { forgotAction, resetPasswordAction, verifyLoginAction, type FormState } from '@/app/admin/actions';

const field = 'h-11 w-full rounded-xl bg-neutral-950 px-4 text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
const card = 'w-full max-w-sm space-y-4 rounded-3xl bg-neutral-900/70 p-7 ring-1 ring-white/10';
const primary = 'h-11 w-full rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-60';

export function VerifyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyLoginAction, {});
  return (
    <form action={action} className={card}>
      <h1 className="text-xl font-semibold text-white">Check WhatsApp</h1>
      <p className="text-sm text-neutral-400">I sent a 6-digit code to your WhatsApp. It works for 10 minutes.</p>
      <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus aria-label="6-digit code" placeholder="••••••" className={`${field} text-center text-2xl tracking-[0.5em]`} />
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className={primary}>{pending ? 'Checking…' : 'Verify and sign in'}</button>
      <Link href="/admin/login" className="block text-center text-sm text-neutral-400 hover:text-white">Start over</Link>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotAction, {});
  return (
    <form action={action} className={card}>
      <h1 className="text-xl font-semibold text-white">Forgot password</h1>
      <p className="text-sm text-neutral-400">Enter your admin email and I’ll send a code to your WhatsApp.</p>
      <input name="email" type="email" autoComplete="username" required aria-label="Admin email" className={field} />
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className={primary}>{pending ? 'Sending…' : 'Send code'}</button>
      <Link href="/admin/login" className="block text-center text-sm text-neutral-400 hover:text-white">Back to sign in</Link>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className={card}>
      <h1 className="text-xl font-semibold text-white">Set a new password</h1>
      <p className="text-sm text-neutral-400">If that email is the admin’s, a 6-digit code is on its way to WhatsApp.</p>
      <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required aria-label="6-digit code" placeholder="••••••" className={`${field} text-center text-2xl tracking-[0.5em]`} />
      <input name="next" type="password" minLength={10} autoComplete="new-password" required aria-label="New password (10 or more characters)" placeholder="New password (10+ characters)" className={field} />
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className={primary}>{pending ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
