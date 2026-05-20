import { Link } from 'react-router-dom';
import {
  buildCampaignStudioPath,
  routes,
} from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { useCampaignOverview } from '@/features/campaigns/model/useCampaignOverview';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';
import { CampaignSummaryGrid } from '@/features/campaigns/ui/CampaignSummaryGrid';

export function DashboardPage() {
  const { campaigns, isLoading, selectedCampaign, selectedCampaignId } = useCampaigns();
  const { campaign, access, summary, isLoading: isOverviewLoading, error } =
    useCampaignOverview(selectedCampaignId);

  if (isLoading && !selectedCampaign) {
    return <p className="text-muted">Loading your campaign dashboard...</p>;
  }

  if (selectedCampaignId && isOverviewLoading && (!campaign || !access || !summary)) {
    return <p className="text-muted">Loading campaign overview...</p>;
  }

  if (selectedCampaignId && error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!selectedCampaign || !campaign || !access || !summary) {
    return (
      <section className="campaign-empty-state">
        <h1 className="h3 mb-3">Choose a campaign to begin</h1>
        <p className="mb-4">
          Your dashboard now follows the currently selected campaign. Start by
          picking one from the top bar or browsing the campaign library.
        </p>
        <div className="d-flex justify-content-center gap-2">
          <Link to={routes.CAMPAIGNS} className="btn btn-secondary btn-sm">
            Browse Campaigns
          </Link>
          <div className="campaign-chip campaign-chip-muted align-self-center">
            {campaigns.length} accessible campaign{campaigns.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="campaign-hero-card mb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h1 className="h3 mb-0">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-muted mb-3">
              {campaign.description || 'This campaign is ready for setup details.'}
            </p>
            <div className="campaign-chip-row">
              <span className="campaign-chip campaign-chip-muted">
                Season {campaign.year}
              </span>
              {access.roleKeys.map((roleKey) => (
                <span key={roleKey} className="campaign-chip">
                  {roleKey}
                </span>
              ))}
            </div>
          </div>
          <Link
            to={buildCampaignStudioPath(campaign.id)}
            className="btn btn-secondary btn-sm"
          >
            Open Campaign Studio
          </Link>
        </div>
      </div>

      {isOverviewLoading ? (
        <p className="text-muted">Refreshing campaign metrics...</p>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="campaign-surface-card">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h5 mb-0">Current Campaign Snapshot</h2>
              <span className="text-muted small">
                {access.capabilities.length}{' '}
                {access.capabilities.length === 1 ? 'capability' : 'capabilities'}
              </span>
            </div>
            <CampaignSummaryGrid counts={summary.counts} />
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="campaign-surface-card h-100">
            <h2 className="h5 mb-3">Readiness Notes</h2>
            <ul className="list-unstyled mb-4">
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>Start date: {campaign.startDate || 'Not set yet'}</span>
              </li>
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>End date: {campaign.endDate || 'Not set yet'}</span>
              </li>
              <li className="d-flex align-items-start gap-2">
                <i className="bi bi-shield-check text-muted" aria-hidden="true" />
                <span>Global role: {access.globalAppRole}</span>
              </li>
            </ul>

            <h3 className="h6 mb-2">Enabled Capabilities</h3>
            <div className="campaign-chip-row">
              {access.capabilities.map((capability) => (
                <span key={capability} className="campaign-chip">
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
