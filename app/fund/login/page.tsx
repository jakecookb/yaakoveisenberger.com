import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/fund/auth/login-form';
import { SetupRequired } from '@/components/fund/setup-required';
import { getFundSession } from '@/lib/fund/auth';
import { safeNext } from '@/lib/fund/connect';
import { isSupabaseConfigured } from '@/lib/fund/env';

export const metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<'/fund/login'>) {
  if (!isSupabaseConfigured) return <SetupRequired area="Organizer sign in" />;
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/fund/portal');
  const session = await getFundSession();
  if (session) redirect(next === '/fund/portal' && session.isPlatformAdmin ? '/fund/admin' : next);
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <LoginForm next={next} initialError={typeof sp.error === 'string' ? sp.error : undefined} />
    </main>
  );
}
