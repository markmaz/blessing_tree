import { useMemo, useState } from 'react';
import { canManageSponsors } from '@/features/campaigns/model/campaignPermissions';
import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import { formatShortDate, toSponsorStatusLabel } from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { CampaignSponsorDrawer } from '@/features/campaigns/ui/CampaignSponsorDrawer';
import '@/features/campaigns/ui/campaignSponsors.css';

export function SponsorsIntakePage() {
  const {
    access,
    workspace,
    pendingRegistrations,
    communicationTemplates,
    communicationTemplateError,
    isLoading,
    isSaving,
    error,
    interactionsBySponsor,
    onLoadSponsorInteractions,
    onPreviewCommunication,
    onSendCommunication,
    onSaveSponsor,
    onDeleteSponsor,
    onSaveInteraction,
    onDeleteInteraction,
    onClearError,
  } = useSponsorWorkspaceContext();

  const canEditSponsors = canManageSponsors(access);
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const selectedSponsor = workspace?.sponsors.find((item) => item.id === selectedSponsorId) ?? null;
  const recentSponsors = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return [...workspace.sponsors]
      .sort((left, right) => {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 6);
  }, [workspace]);

  if (isLoading && !workspace) {
    return <p className="text-muted">Loading sponsor intake...</p>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load sponsor intake.'}
      </div>
    );
  }

  return (
    <section className="campaign-page-stack">
      {error ? (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <span>{error}</span>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={onClearError}>
              <i className="bi bi-x-circle me-2" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="h3 mb-1">Sponsors Intake</h1>
        <p className="text-muted mb-0">
          Add staff-entered sponsors quickly, then return to the directory for broader maintenance and reporting.
        </p>
      </div>

      <div className="campaign-people-intake-grid">
        <button
          type="button"
          className="campaign-people-intake-card"
          onClick={() => {
            setSelectedSponsorId(null);
            setIsCreateOpen(true);
          }}
          disabled={!canEditSponsors}
        >
          <span className="campaign-people-intake-card__icon">
            <i className="bi bi-person-heart" aria-hidden="true" />
          </span>
          <span className="campaign-people-intake-card__title">Add Sponsor</span>
          <span className="campaign-people-intake-card__body">
            Capture the sponsor record, campaign participation details, and follow-up notes without leaving the intake flow.
          </span>
        </button>

        <div className="campaign-people-intake-card campaign-sponsor-intake-card__info">
          <span className="campaign-people-intake-card__icon">
            <i className="bi bi-qr-code-scan" aria-hidden="true" />
          </span>
          <span className="campaign-people-intake-card__title">Public Signup</span>
          <span className="campaign-people-intake-card__body">
            Campaign Studio will manage the QR and public self-registration flow. Pending public signups will appear here for review.
          </span>
        </div>
      </div>

      <section className="campaign-team-workspace__section">
        <div className="campaign-team-workspace__section-header">
          <div>
            <h2 className="h5 mb-1">Continue Recent Sponsor Work</h2>
            <p className="text-muted mb-0">
              Re-open a recently updated sponsor to adjust participation, record a contact attempt, or review gifts.
            </p>
          </div>
        </div>

        <div className="campaign-team-inline-list">
          {recentSponsors.length === 0 ? (
            <div className="campaign-studio__empty-note">No sponsor records yet. Start with Add Sponsor.</div>
          ) : (
            recentSponsors.map((sponsor) => (
              <div key={sponsor.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                <div className="campaign-team-inline-item__content">
                  <strong>{sponsor.displayName}</strong>
                  <div className="campaign-team-inline-meta">
                    <span className="campaign-chip campaign-chip-muted">
                      <i className="bi bi-heart-fill me-1" aria-hidden="true" />
                      {toSponsorStatusLabel(sponsor.participation.status)}
                    </span>
                    <span className="campaign-chip campaign-chip-muted">
                      <i className="bi bi-gift me-1" aria-hidden="true" />
                      {sponsor.sponsoredItemCount} gift{sponsor.sponsoredItemCount === 1 ? '' : 's'}
                    </span>
                    <span className="campaign-chip campaign-chip-muted">
                      <i className="bi bi-clock-history me-1" aria-hidden="true" />
                      Updated {formatShortDate(sponsor.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="campaign-team-inline-item__actions">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setSelectedSponsorId(sponsor.id);
                    }}
                  >
                    <i className="bi bi-arrow-right-circle me-2" aria-hidden="true" />
                    Continue Sponsor
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="campaign-team-workspace__section">
        <div className="campaign-team-workspace__section-header">
          <div>
            <h2 className="h5 mb-1">Pending Public Registrations</h2>
            <p className="text-muted mb-0">
              These self-registration attempts have not verified their email yet and will expire automatically.
            </p>
          </div>
        </div>

        {pendingRegistrations.length === 0 ? (
          <div className="campaign-studio__empty-note">No pending public sponsor registrations.</div>
        ) : (
          <div className="campaign-sponsor-list">
            {pendingRegistrations.slice(0, 8).map((registration) => (
              <div key={registration.id} className="campaign-sponsor-list__item">
                <div>
                  <strong>{registration.displayName ?? registration.email}</strong>
                  <div className="text-muted small">
                    {registration.email} · {registration.selectedWishlistItemIds.length} selected gift{registration.selectedWishlistItemIds.length === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-hourglass-split" aria-hidden="true" />
                  <span>Expires {formatShortDate(registration.expiresAt)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <CampaignSponsorDrawer
        key={selectedSponsor?.id ?? (isCreateOpen ? 'create-sponsor' : 'closed-sponsor')}
        isOpen={isCreateOpen || selectedSponsor !== null}
        canEdit={canEditSponsors}
        isSaving={isSaving}
        sponsor={selectedSponsor}
        communicationTemplates={communicationTemplates}
        communicationTemplateError={communicationTemplateError}
        interactionsState={selectedSponsor ? interactionsBySponsor[selectedSponsor.id] : undefined}
        onLoadInteractions={onLoadSponsorInteractions}
        onPreviewCommunication={onPreviewCommunication}
        onSendCommunication={onSendCommunication}
        onSaveSponsor={onSaveSponsor}
        onDeleteSponsor={onDeleteSponsor}
        onSaveInteraction={onSaveInteraction}
        onDeleteInteraction={onDeleteInteraction}
        onClose={() => {
          setIsCreateOpen(false);
          setSelectedSponsorId(null);
        }}
        onSaved={(sponsor) => {
          setIsCreateOpen(false);
          setSelectedSponsorId(sponsor.id);
        }}
      />
    </section>
  );
}
