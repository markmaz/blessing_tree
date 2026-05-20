import type { CampaignStatus } from '@/features/campaigns/model/campaignTypes';

const statusClassNames: Record<CampaignStatus, string> = {
  DRAFT: 'bg-secondary-subtle text-secondary-emphasis',
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  CLOSED: 'bg-warning-subtle text-warning-emphasis',
  ARCHIVED: 'bg-dark-subtle text-dark-emphasis',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`badge rounded-pill ${statusClassNames[status]}`}>
      {status}
    </span>
  );
}
