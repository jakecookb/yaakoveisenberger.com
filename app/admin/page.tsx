import { AdminEditor } from '@/components/admin/admin-editor';
import { isBlobConfigured } from '@/lib/admin/store';
import { requireAdmin } from '@/lib/admin/session';
import { listRequests } from '@/lib/access/visitor';
import { loadSettings } from '@/lib/site/load';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editor' };

export default async function AdminPage() {
  await requireAdmin();
  const [settings, requests] = await Promise.all([loadSettings(), listRequests()]);
  const pending = requests.filter((r) => r.requested.length > 0).length;
  return <AdminEditor initial={settings} blobReady={isBlobConfigured} pending={pending} email={process.env.ADMIN_EMAIL ?? ''} />;
}
