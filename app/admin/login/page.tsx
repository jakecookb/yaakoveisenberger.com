import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/admin/login-form';
import { isAdmin, isAdminConfigured } from '@/lib/admin/session';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  if (await isAdmin()) redirect('/admin');
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-16">
      {isAdminConfigured ? (
        <LoginForm changed={sp.changed === '1'} />
      ) : (
        <div className="max-w-sm rounded-3xl bg-neutral-900/70 p-7 text-sm text-neutral-300 ring-1 ring-white/10">
          <h1 className="text-xl font-semibold text-white">Admin isn’t set up yet</h1>
          <p className="mt-3">Set <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD_HASH</code> and <code>ADMIN_SESSION_SECRET</code> in the Vercel project, then redeploy.</p>
        </div>
      )}
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Back to the site</Link>
    </main>
  );
}
