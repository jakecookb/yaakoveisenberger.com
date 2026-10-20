'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type FormState } from '@/app/admin/actions';

export function LoginForm({ changed }: { changed?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const field = 'h-11 w-full rounded-xl bg-neutral-950 px-4 text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-3xl bg-neutral-900/70 p-7 ring-1 ring-white/10">
      <h1 className="text-xl font-semibold text-white">Admin sign in</h1>
      {changed && <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">Password changed. Sign in again.</p>}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-300">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-300">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="h-11 w-full rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-60">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <Link href="/admin/login/forgot" className="block text-center text-sm text-neutral-400 hover:text-white">Forgot password?</Link>
    </form>
  );
}
