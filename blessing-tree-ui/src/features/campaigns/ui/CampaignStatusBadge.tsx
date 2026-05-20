import type { CampaignStatus } from '@/features/campaigns/model/campaignTypes';

const statusClassNames: Record<CampaignStatus, string> = {
  DRAFT: 'is-draft',
  ACTIVE: 'is-active',
  CLOSED: 'is-closed',
  ARCHIVED: 'is-archived',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`campaign-status-badge ${statusClassNames[status]}`}>
      {status}
    </span>
  );
}
