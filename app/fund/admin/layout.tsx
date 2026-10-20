import { DashboardShell, type NavItem } from '@/components/fund/dashboard/shell';
import { SetupRequired } from '@/components/fund/setup-required';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { isSupabaseConfigured } from '@/lib/fund/env';

export const metadata = { title: { default: 'Platform admin', template: '%s · Platform admin' }, robots: { index: false } };

const NAV: NavItem[] = [
  { href: '/fund/admin', label: 'Overview', icon: 'overview', exact: true },
  { href: '/fund/admin/campaigns', label: 'Campaigns', icon: 'campaigns' },
  { href: '/fund/admin/organizations', label: 'Nonprofits & Stripe', icon: 'organizations' },
  { href: '/fund/admin/monitor', label: 'Fraud & transactions', icon: 'monitor' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <SetupRequired area="The platform admin dashboard" />;
  const { user } = await requirePlatformAdmin();
  return (
    <DashboardShell brand="Fund · Platform admin" nav={NAV} email={user.email ?? ''}>
      {children}
    </DashboardShell>
  );
}
