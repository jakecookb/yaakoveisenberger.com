import { getCampaignAccess } from '@/lib/fund/auth';
import { DashboardShell, type NavItem } from '@/components/fund/dashboard/shell';

export default async function CampaignPortalLayout({ children, params }: LayoutProps<'/fund/portal/[campaignSlug]'>) {
  const { campaignSlug } = await params;
  const { campaign, user } = await getCampaignAccess(campaignSlug);
  const base = `/fund/portal/${campaign.slug}`;
  const nav: NavItem[] = [
    { href: base, label: 'Dashboard', icon: 'overview', exact: true },
    { href: `${base}/donations`, label: 'Donations & offline entry', icon: 'donations' },
    { href: `${base}/matchers`, label: 'Matchers', icon: 'matchers' },
    { href: `${base}/teams`, label: 'Teams & ambassadors', icon: 'teams' },
    { href: `${base}/links`, label: 'Links', icon: 'links' },
    { href: `${base}/outreach`, label: 'Outreach', icon: 'outreach' },
    { href: `${base}/settings`, label: 'Settings', icon: 'settings' },
  ];
  return (
    <DashboardShell
      brand={campaign.title}
      nav={nav}
      email={user.email ?? ''}
      themeColor={campaign.theme_color}
      actions={{ publicUrl: `/fund/${campaign.slug}`, displayUrl: `/fund/display/${campaign.slug}` }}
    >
      {children}
    </DashboardShell>
  );
}
