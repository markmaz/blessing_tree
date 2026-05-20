import { Link } from 'react-router-dom';
import { buildCampaignDetailPath } from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';

function formatWindow(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) {
    return 'Dates not set';
  }
  if (startDate && endDate) {
    return `${startDate} to ${endDate}`;
  }
  return startDate ?? endDate ?? 'Dates not set';
}

export function CampaignsPage() {
  const {
    campaigns,
    error,
    isLoading,
    selectedCampaignId,
    selectCampaign,
  } = useCampaigns();

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (isLoading && campaigns.length === 0) {
    return <p className="text-muted">Loading campaigns...</p>;
  }

  if (campaigns.length === 0) {
    return (
      <section className="campaign-empty-state">
        <h1 className="h3 mb-3">No campaigns are available yet</h1>
        <p className="mb-0">
          Once an administrator creates a campaign and assigns access, it will
          appear here.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Campaigns</h1>
          <p className="text-muted mb-0">
            Choose the operating season you want to work in, then open its
            detail workspace.
          </p>
        </div>
        <div className="campaign-chip campaign-chip-muted">
          {campaigns.length} accessible campaign{campaigns.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="campaign-card-grid">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="campaign-card">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">{campaign.name}</h2>
                <div className="campaign-card-meta">Season {campaign.year}</div>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </div>

            <p className="campaign-card-description text-muted mb-3">
              {campaign.description || 'No campaign description has been added yet.'}
            </p>

            <div className="campaign-card-meta mb-3">
              <div className="mb-1">
                <strong>Window:</strong> {formatWindow(campaign.startDate, campaign.endDate)}
              </div>
              <div>
                <strong>Role bundle:</strong> {campaign.userAccess.roleKeys.join(', ') || 'No role keys'}
              </div>
            </div>

            <div className="campaign-chip-row mb-4">
              {campaign.userAccess.capabilities.slice(0, 4).map((capability) => (
                <span key={capability} className="campaign-chip">
                  {capability}
                </span>
              ))}
              {campaign.userAccess.capabilities.length > 4 ? (
                <span className="campaign-chip campaign-chip-muted">
                  +{campaign.userAccess.capabilities.length - 4} more
                </span>
              ) : null}
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => selectCampaign(campaign.id)}
              >
                {selectedCampaignId === campaign.id ? 'Current Campaign' : 'Make Current'}
              </button>
              <Link
                to={buildCampaignDetailPath(campaign.id)}
                className="btn btn-outline-secondary btn-sm"
              >
                Open Details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
