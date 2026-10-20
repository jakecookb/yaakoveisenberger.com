'use client';

import { useTransition } from 'react';
import { Check, Pause, Play, Archive, Flag, RotateCcw } from 'lucide-react';
import { setCampaignStatus } from '@/lib/fund/actions/admin';
import { requestCampaignStatus } from '@/lib/fund/actions/portal';
import type { CampaignStatus } from '@/lib/fund/types';
import { Button } from '../ui/primitives';
import { useToast } from '../ui/toast';

/** Status transitions. Admins can do anything; managers get the subset the DB allows them. */
export function CampaignStatusActions({ campaignId, status, approved, mode = 'admin', size = 'sm' }: { campaignId: string; status: CampaignStatus; approved?: boolean; mode?: 'admin' | 'manager'; size?: 'sm' | 'md' }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const run = (next: CampaignStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      result(mode === 'admin' ? await setCampaignStatus(campaignId, next) : await requestCampaignStatus(campaignId, next));
    });
  };

  const buttons: React.ReactNode[] = [];
  if (mode === 'admin') {
    if (status === 'pending_review' || status === 'draft')
      buttons.push(<Button key="approve" size={size} onClick={() => run('active', 'Approve and publish this campaign?')} loading={pending}><Check className="size-4" /> Approve & publish</Button>);
    if (status === 'active') buttons.push(<Button key="pause" size={size} variant="secondary" onClick={() => run('paused')} loading={pending}><Pause className="size-4" /> Pause</Button>);
    if (status === 'paused') buttons.push(<Button key="resume" size={size} variant="secondary" onClick={() => run('active')} loading={pending}><Play className="size-4" /> Resume</Button>);
    if (status === 'active' || status === 'paused') buttons.push(<Button key="complete" size={size} variant="ghost" onClick={() => run('completed', 'Mark as completed? Donations will close.')}><Flag className="size-4" /> Complete</Button>);
    if (status !== 'archived') buttons.push(<Button key="archive" size={size} variant="ghost" onClick={() => run('archived', 'Archive this campaign? It disappears from public pages.')}><Archive className="size-4" /> Archive</Button>);
    if (status === 'archived' || status === 'completed') buttons.push(<Button key="restore" size={size} variant="ghost" onClick={() => run('draft')}><RotateCcw className="size-4" /> Back to draft</Button>);
  } else {
    if (status === 'draft') buttons.push(<Button key="submit" size={size} onClick={() => run('pending_review')} loading={pending}><Check className="size-4" /> Submit for review</Button>);
    if (status === 'pending_review') buttons.push(<Button key="withdraw" size={size} variant="secondary" onClick={() => run('draft')} loading={pending}>Withdraw submission</Button>);
    if (status === 'active') buttons.push(<Button key="pause" size={size} variant="secondary" onClick={() => run('paused', 'Pause donations?')} loading={pending}><Pause className="size-4" /> Pause donations</Button>);
    if (status === 'paused' && approved) buttons.push(<Button key="resume" size={size} onClick={() => run('active')} loading={pending}><Play className="size-4" /> Resume</Button>);
    if (status === 'active' || status === 'paused') buttons.push(<Button key="end" size={size} variant="ghost" onClick={() => run('completed', 'End the campaign now? This cannot be undone without an admin.')}><Flag className="size-4" /> End campaign</Button>);
  }
  return <div className="flex flex-wrap gap-2">{buttons}</div>;
}
