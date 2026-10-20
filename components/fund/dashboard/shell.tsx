'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Megaphone, Building2, ShieldAlert, Users, Link2, PhoneCall, HandCoins, Settings, Handshake, ExternalLink, LogOut, MonitorPlay,
} from 'lucide-react';
import { cn } from '../ui/cn';

const ICONS = {
  overview: LayoutDashboard, campaigns: Megaphone, organizations: Building2, monitor: ShieldAlert, teams: Users,
  links: Link2, outreach: PhoneCall, donations: HandCoins, settings: Settings, matchers: Handshake,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
}

export function DashboardShell({
  brand,
  nav,
  email,
  actions,
  themeColor,
  children,
}: {
  brand: string;
  nav: NavItem[];
  email: string;
  actions?: { publicUrl?: string; displayUrl?: string };
  themeColor?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="fund-theme min-h-screen bg-slate-50" style={themeColor ? ({ '--fund-accent': themeColor } as React.CSSProperties) : undefined}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/fund" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--fund-accent)] text-xs font-bold text-white">F</span>
            {brand}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {actions?.publicUrl && (
              <a href={actions.publicUrl} target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 sm:inline-flex">
                <ExternalLink className="size-4" /> Public page
              </a>
            )}
            {actions?.displayUrl && (
              <a href={actions.displayUrl} target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 sm:inline-flex">
                <MonitorPlay className="size-4" /> Big screen
              </a>
            )}
            <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline">{email}</span>
            <form action="/fund/auth/signout" method="post">
              <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Sections">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active ? 'border-[var(--fund-accent)] font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
