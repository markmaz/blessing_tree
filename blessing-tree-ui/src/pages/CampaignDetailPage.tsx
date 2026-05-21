import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildCampaignStudioPath, routes } from '@/app/routes';
import { updateCampaign } from '@/features/campaigns/api/campaignApi';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignUpsertInput } from '@/features/campaigns/model/campaignTypes';
import { CampaignEditorForm } from '@/features/campaigns/ui/CampaignEditorForm';
import { useCampaignOverview } from '@/features/campaigns/model/useCampaignOverview';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';
import { CampaignSummaryGrid } from '@/features/campaigns/ui/CampaignSummaryGrid';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

function metadataValue(value: string | null): string {
  return value || 'Not set';
}

export function CampaignDetailPage() {
  const { campaignId = null } = useParams();
  const { campaigns, selectedCampaignId, selectCampaign, reloadCampaigns } = useCampaigns();
  const { campaign, access, summary, isLoading, error, reload } = useCampaignOverview(campaignId);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      return;
    }

    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  if (!campaignId) {
    return null;
  }

  if (isLoading) {
    return <p className="text-muted">Loading campaign details...</p>;
  }

  if (error || !campaign || !access || !summary) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load campaign details.'}
      </div>
    );
  }

  const isCurrentCampaign = selectedCampaignId === campaignId;
  const otherCampaignCount = Math.max(campaigns.length - 1, 0);
  const showAdminEditor = canManageCampaign(access);

  const handleUpdateCampaign = async (input: CampaignUpsertInput) => {
    setIsEditing(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await updateCampaign(campaignId, input);
      await Promise.all([reloadCampaigns(), reload()]);
      setSaveMessage('Campaign updated.');
      return true;
    } catch (updateCampaignError) {
      setSaveError(
        updateCampaignError instanceof Error
          ? updateCampaignError.message
          : 'Unable to update campaign'
      );
      return false;
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <section className="campaign-page-stack">
      <div className="campaign-hero-card mb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h1 className="h3 mb-0">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-muted mb-3">
              {campaign.description || 'No campaign description has been written yet.'}
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

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => selectCampaign(campaignId)}
              disabled={isCurrentCampaign}
            >
              <i
                className={`bi ${isCurrentCampaign ? 'bi-check2-circle' : 'bi-bullseye'} me-2`}
                aria-hidden="true"
              />
              {isCurrentCampaign ? 'Current Campaign' : 'Make Current'}
            </button>
            <Link to={routes.CAMPAIGNS} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-2" aria-hidden="true" />
              Back to Campaigns
            </Link>
            <Link
              to={buildCampaignStudioPath(campaignId)}
              className="btn btn-secondary btn-sm"
            >
              <i className="bi bi-kanban me-2" aria-hidden="true" />
              Open Studio
            </Link>
          </div>
        </div>
      </div>

      {showAdminEditor ? (
        <section className="campaign-surface-card">
          {saveError ? (
            <div className="alert alert-danger" role="alert">
              {saveError}
            </div>
          ) : null}
          {saveMessage ? (
            <AutoDismissAlert
              key={saveMessage}
              message={saveMessage}
              onDismiss={() => setSaveMessage(null)}
            />
          ) : null}
          <CampaignEditorForm
            campaign={campaign}
            title="Edit Campaign Setup"
            description="Managers and app admins can update the campaign metadata, lifecycle, and operating dates here."
            submitLabel="Save Campaign"
            isSaving={isEditing}
            onSubmit={handleUpdateCampaign}
          />
        </section>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="campaign-surface-card">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h5 mb-0">Operational Snapshot</h2>
              <span className="text-muted small">
                {otherCampaignCount} other campaign{otherCampaignCount === 1 ? '' : 's'} accessible
              </span>
            </div>
            <CampaignSummaryGrid counts={summary.counts} />
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="campaign-surface-card h-100">
            <h2 className="h5 mb-3">Campaign Access</h2>
            <div className="campaign-chip-row mb-3">
              {access.capabilities.map((capability) => (
                <span key={capability} className="campaign-chip">
                  {capability}
                </span>
              ))}
            </div>

            <dl className="row mb-0">
              <dt className="col-sm-5">Start Date</dt>
              <dd className="col-sm-7">{metadataValue(campaign.startDate)}</dd>

              <dt className="col-sm-5">End Date</dt>
              <dd className="col-sm-7">{metadataValue(campaign.endDate)}</dd>

              <dt className="col-sm-5">Created</dt>
              <dd className="col-sm-7">{metadataValue(campaign.createdAt)}</dd>

              <dt className="col-sm-5">Updated</dt>
              <dd className="col-sm-7">{metadataValue(campaign.updatedAt)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
