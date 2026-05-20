import type {
  CampaignStudioData,
} from '@/features/campaigns/model/campaignStudioTypes';
import { buildCampaignDetailPath } from '@/app/routes';
import { campaignSummaryLabels } from '@/features/campaigns/api/campaignApi';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';
import { CampaignSummaryGrid } from '@/features/campaigns/ui/CampaignSummaryGrid';
import { Link } from 'react-router-dom';

export function CampaignStudioOverview({
  studio,
  onEditCampaign,
}: {
  studio: CampaignStudioData;
  onEditCampaign: () => void;
}) {
  const { campaign, access, summary, team, communications, milestones, readiness } = studio;
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
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onEditCampaign}
            >
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
          <div className="campaign-chip-row mb-3">
            {Object.entries(team.counts.roleCounts).map(([roleKey, count]) => (
              <span key={roleKey} className="campaign-chip">
                {roleKey} · {count}
              </span>
            ))}
          </div>
          <div className="small text-muted">
            {team.counts.memberCount} people are assigned across {team.counts.activeAssignmentCount}{' '}
            active campaign roles.
          </div>
        </article>

        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Communications</div>
          <h2 className="h5 mb-3">Templates and Scheduled Touchpoints</h2>
          <div className="campaign-chip-row">
            <span className="campaign-chip">
              {communications.templates.length} templates
            </span>
            <span className="campaign-chip campaign-chip-muted">
              {communications.schedules.length} schedules
            </span>
          </div>
        </article>

        <article className="campaign-surface-card">
          <div className="campaign-studio__card-eyebrow">Dates</div>
          <h2 className="h5 mb-3">Milestones</h2>
          <div className="campaign-studio__milestone-list">
            {milestones.length === 0 ? (
              <div className="small text-muted">No milestone dates have been saved yet.</div>
            ) : (
              milestones.slice(0, 3).map((milestone) => (
                <div key={milestone.id} className="campaign-studio__milestone-item">
                  <span>{milestone.label}</span>
                  <strong>{milestone.occursOn || 'Not set'}</strong>
                </div>
              ))
            )}
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
            {(readiness.items.length === 0
              ? [{ message: 'The campaign is currently ready for deeper build-out.', severity: 'info' as const }]
              : readiness.items
            ).map((item) => (
              <div
                key={item.message}
                className={`campaign-studio__readiness-item ${
                  item.severity === 'error' || item.severity === 'warning'
                    ? 'needs-attention'
                    : 'healthy'
                }`}
              >
                <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
