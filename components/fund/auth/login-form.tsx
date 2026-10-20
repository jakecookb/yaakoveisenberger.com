'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, KeyRound } from 'lucide-react';
import { getFundBrowserClient } from '@/lib/fund/supabase/browser';
import { Button, Card, Field, Input } from '../ui/primitives';
import { cn } from '../ui/cn';

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(false);
  const supabase = getFundBrowserClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setError('Supabase is not configured yet.');
    setBusy(true);
    setError(null);
    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/fund/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
      });
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
      // The login page's server check routes platform admins to /fund/admin, everyone else to `next`.
      else {
        router.replace(`/fund/login?next=${encodeURIComponent(next)}`);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">Organizer sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Platform admins and campaign managers.</p>
      <div className="mt-5 flex rounded-xl bg-slate-100 p-1 text-sm">
        {(['magic', 'password'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5', mode === m ? 'bg-white font-medium shadow-sm' : 'text-slate-500')}>
            {m === 'magic' ? <Mail className="size-4" /> : <KeyRound className="size-4" />}
            {m === 'magic' ? 'Email link' : 'Password'}
          </button>
        ))}
      </div>
      {sent ? (
        <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Check <b>{email}</b> for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Email">{(id) => <Input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          {mode === 'password' && (
            <Field label="Password">{(id) => <Input id={id} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" variant="dark" className="w-full" loading={busy}>
            {mode === 'magic' ? 'Send sign-in link' : 'Sign in'}
          </Button>
        </form>
      )}
    </Card>
  );
}
