import { Link } from 'react-router-dom';
import { buildCampaignDetailPath } from '@/app/routes';
import { campaignSummaryLabels } from '@/features/campaigns/api/campaignApi';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';
import { CampaignSummaryGrid } from '@/features/campaigns/ui/CampaignSummaryGrid';
import type {
  Campaign,
  CampaignAccess,
  CampaignSummary,
} from '@/features/campaigns/model/campaignTypes';

interface CampaignStudioOverviewProps {
  campaign: Campaign;
  access: CampaignAccess;
  summary: CampaignSummary;
}

interface ReadinessItem {
  label: string;
  tone: 'attention' | 'healthy';
}

function buildReadinessItems(
  campaign: Campaign,
  access: CampaignAccess,
  summary: CampaignSummary
): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  if (!campaign.description) {
    items.push({
      label: 'Add a campaign description so staff understand the season intent.',
      tone: 'attention',
    });
  }

  if (!campaign.startDate || !campaign.endDate) {
    items.push({
      label: 'Set the campaign operating window before activation.',
      tone: 'attention',
    });
  }

  if (campaign.status === 'DRAFT') {
    items.push({
      label: 'The campaign is still in draft and not yet open for live operations.',
      tone: 'attention',
    });
  }

  if (summary.counts.recipientGroups === 0) {
    items.push({
      label: 'No recipient groups have been added yet.',
      tone: 'attention',
    });
  }

  if (access.roleKeys.length === 0) {
    items.push({
      label: 'No campaign-specific role bundles are assigned to you yet.',
      tone: 'attention',
    });
  }

  if (items.length === 0) {
    items.push({
      label: 'The current campaign shell is healthy enough to keep building.',
      tone: 'healthy',
    });
  }

  return items;
}

export function CampaignStudioOverview({
  campaign,
  access,
  summary,
}: CampaignStudioOverviewProps) {
  const readinessItems = buildReadinessItems(campaign, access, summary);
  const topMetric = campaignSummaryLabels
    .slice(0, 3)
    .map((item) => `${item.label}: ${summary.counts[item.key]}`);

  return (
    <div className="campaign-studio__canvas-stack">
      <section className="campaign-hero-card">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h1 className="h3 mb-0">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-muted mb-3">
              {campaign.description || 'This campaign still needs its operating narrative.'}
            </p>
            <div className="campaign-chip-row">
              <span className="campaign-chip campaign-chip-muted">
                Season {campaign.year}
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {access.globalAppRole}
              </span>
              {access.roleKeys.map((roleKey) => (
                <span key={roleKey} className="campaign-chip">
                  {roleKey}
                </span>
              ))}
            </div>
          </div>

          <div className="campaign-studio__hero-actions">
            <Link
              className="btn btn-outline-secondary btn-sm"
              to={buildCampaignDetailPath(campaign.id)}
            >
              Open Detail View
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" disabled>
              Edit Campaign Setup
            </button>
          </div>
        </div>
      </section>

      <div className="campaign-studio__overview-grid">
        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Campaign Setup</div>
          <h2 className="h5 mb-3">Identity and Lifecycle</h2>
          <dl className="row mb-0">
            <dt className="col-sm-5">Status</dt>
            <dd className="col-sm-7">{campaign.status}</dd>

            <dt className="col-sm-5">Start Date</dt>
            <dd className="col-sm-7">{campaign.startDate || 'Not set'}</dd>

            <dt className="col-sm-5">End Date</dt>
            <dd className="col-sm-7">{campaign.endDate || 'Not set'}</dd>

            <dt className="col-sm-5">Access</dt>
            <dd className="col-sm-7">{access.capabilities.length} capabilities active</dd>
          </dl>
        </article>

        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Team</div>
          <h2 className="h5 mb-3">Current Operators</h2>
          <p className="text-muted mb-3">
            Phase 1 shows the current role bundles attached to your session while
            assignment APIs are being added.
          </p>
          <div className="campaign-chip-row mb-3">
            {access.roleKeys.map((roleKey) => (
              <span key={roleKey} className="campaign-chip">
                {roleKey}
              </span>
            ))}
          </div>
          <div className="small text-muted">
            Next API slice: add managers, coordinators, and volunteers directly
            from this card.
          </div>
        </article>

        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Communications</div>
          <h2 className="h5 mb-3">Templates and Scheduled Touchpoints</h2>
          <p className="text-muted mb-3">
            Communication templates and schedules are not attached yet. This
            card will become the launch point for sponsor reminders, volunteer
            onboarding, and pickup communications.
          </p>
          <div className="campaign-chip-row">
            <span className="campaign-chip campaign-chip-muted">Templates pending</span>
            <span className="campaign-chip campaign-chip-muted">Schedules pending</span>
          </div>
        </article>

        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Dates</div>
          <h2 className="h5 mb-3">Milestones</h2>
          <div className="campaign-studio__milestone-list">
            <div className="campaign-studio__milestone-item">
              <span>Campaign window opens</span>
              <strong>{campaign.startDate || 'Not set'}</strong>
            </div>
            <div className="campaign-studio__milestone-item">
              <span>Campaign window closes</span>
              <strong>{campaign.endDate || 'Not set'}</strong>
            </div>
            <div className="campaign-studio__milestone-item">
              <span>Next milestone layer</span>
              <strong>Registration and pickup dates pending</strong>
            </div>
          </div>
        </article>

        <article className="campaign-surface-card campaign-studio__overview-span-2">
          <div className="campaign-studio__card-eyebrow">Operational Snapshot</div>
          <h2 className="h5 mb-3">Current Campaign Metrics</h2>
          <p className="text-muted mb-4">{topMetric.join(' · ')}</p>
          <CampaignSummaryGrid counts={summary.counts} />
        </article>

        <article className="campaign-surface-card campaign-studio__overview-span-2">
          <div className="campaign-studio__card-eyebrow">Readiness</div>
          <h2 className="h5 mb-3">What Still Needs Attention</h2>
          <div className="campaign-studio__readiness-list">
            {readinessItems.map((item) => (
              <div
                key={item.label}
                className={`campaign-studio__readiness-item ${item.tone === 'attention' ? 'needs-attention' : 'healthy'}`}
              >
                <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
