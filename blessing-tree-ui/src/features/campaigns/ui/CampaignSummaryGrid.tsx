import {
  campaignSummaryLabels,
} from '@/features/campaigns/api/campaignApi';
import type { CampaignSummaryCounts } from '@/features/campaigns/model/campaignTypes';

export function CampaignSummaryGrid({
  counts,
}: {
  counts: CampaignSummaryCounts;
}) {
  return (
    <div className="row g-3">
      {campaignSummaryLabels.map((item) => (
        <div key={item.key} className="col-12 col-sm-6 col-xl-4">
          <div className="campaign-metric-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="campaign-metric-label">{item.label}</span>
              <i className={`bi ${item.icon} campaign-metric-icon`} aria-hidden="true" />
            </div>
            <div className="campaign-metric-value">{counts[item.key]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
