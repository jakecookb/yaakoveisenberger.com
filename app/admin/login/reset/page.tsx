import { redirect } from 'next/navigation';
import { ResetForm } from '@/components/admin/code-forms';
import { isAdmin } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function Page() {
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <ResetForm />
    </main>
  );
}
