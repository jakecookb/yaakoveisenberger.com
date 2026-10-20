import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/fund/ui/toast';
import './fund.css';

export const metadata: Metadata = {
  title: { default: 'Fundraising', template: '%s · Fund' },
  description: 'Matching campaigns powered by yaakoveisenberger.com/fund',
};

export const viewport: Viewport = { themeColor: '#4f46e5' };

export default function FundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fund-root min-h-screen bg-[var(--fund-canvas)]">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
