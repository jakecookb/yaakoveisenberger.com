'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Trash2 } from 'lucide-react';
import { deleteCampaign, recalculateCampaign } from '@/lib/fund/actions/admin';
import { Button, Card, CardHeader } from '../ui/primitives';
import { useToast } from '../ui/toast';

export function CampaignDangerZone({ campaignId, hasDonations }: { campaignId: string; hasDonations: boolean }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Maintenance" description="Repair tools and irreversible actions." />
      <div className="flex flex-wrap gap-3 p-5">
        <Button variant="secondary" loading={pending} onClick={() => start(async () => void result(await recalculateCampaign(campaignId)))}>
          <Calculator className="size-4" /> Recalculate totals from ledger
        </Button>
        <Button
          variant="danger"
          disabled={hasDonations}
          title={hasDonations ? 'Campaigns with donations can only be archived' : undefined}
          onClick={() => {
            if (!window.confirm('Delete this campaign permanently?')) return;
            start(async () => {
              const res = await deleteCampaign(campaignId);
              if (result(res)) router.push('/fund/admin/campaigns');
            });
          }}
        >
          <Trash2 className="size-4" /> Delete campaign
        </Button>
      </div>
    </Card>
  );
}
