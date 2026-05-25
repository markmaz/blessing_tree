import { useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/campaigns/ui/campaignPeople.css';
import '@/features/campaigns/ui/campaignSponsors.css';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  CampaignSponsorWorkspaceData,
  PendingSponsorRegistration,
  SponsorInteractionUpsertInput,
  SponsorUpsertInput,
  SponsorshipUpsertInput,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { canManageSponsors } from '@/features/campaigns/model/campaignPermissions';
import {
  formatShortDate,
  summarizeFollowUp,
  toSponsorDropOffStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { CampaignSponsorDrawer } from '@/features/campaigns/ui/CampaignSponsorDrawer';
import { CampaignSponsorTable } from '@/features/campaigns/ui/CampaignSponsorTable';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';

interface CampaignSponsorsWorkspaceProps {
  access: CampaignAccess | null;
  workspace: CampaignSponsorWorkspaceData | null;
  pendingRegistrations: PendingSponsorRegistration[];
  pendingRegistrationError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  interactionsBySponsor: Record<
    string,
    {
      items: CampaignSponsorInteraction[];
      isLoading: boolean;
      error: string | null;
      loaded: boolean;
    }
  >;
  onLoadSponsorInteractions: (sponsorId: string) => Promise<CampaignSponsorInteraction[]>;
  onSaveSponsor: (
    sponsor: SponsorUpsertInput,
    participation: SponsorshipUpsertInput,
    sponsorId?: string
  ) => Promise<CampaignSponsor | null>;
  onDeleteSponsor: (sponsorId: string) => Promise<boolean>;
  onSaveInteraction: (
    sponsorId: string,
    input: SponsorInteractionUpsertInput,
    interactionId?: string
  ) => Promise<CampaignSponsorInteraction | null>;
  onDeleteInteraction: (sponsorId: string, interactionId: string) => Promise<boolean>;
  onResendPendingRegistration: (registrationId: string) => Promise<boolean>;
  onCancelPendingRegistration: (registrationId: string) => Promise<boolean>;
  onVerifyPendingRegistration: (registrationId: string) => Promise<boolean>;
  onClearError: () => void;
  showCreateActions?: boolean;
}

export function CampaignSponsorsWorkspace({
  access,
  workspace,
  pendingRegistrations,
  pendingRegistrationError,
  isLoading,
  isSaving,
  error,
  interactionsBySponsor,
  onLoadSponsorInteractions,
  onSaveSponsor,
  onDeleteSponsor,
  onSaveInteraction,
  onDeleteInteraction,
  onResendPendingRegistration,
  onCancelPendingRegistration,
  onVerifyPendingRegistration,
  onClearError,
  showCreateActions = true,
}: CampaignSponsorsWorkspaceProps) {
  const canEditSponsors = canManageSponsors(access);
  const [search, setSearch] = useState('');
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingDeleteSponsorId, setPendingDeleteSponsorId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredSponsors = useMemo(() => {
    if (!workspace) {
      return [];
    }
    const normalizedSearch = search.trim().toLowerCase();
    return workspace.sponsors.filter((sponsor) => {
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        sponsor.displayName,
        sponsor.organizationName ?? '',
        sponsor.email ?? '',
        sponsor.phone ?? '',
        sponsor.participation.sponsorCode ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [search, workspace]);

  const selectedSponsor = workspace?.sponsors.find((item) => item.id === selectedSponsorId) ?? null;
  const pendingDeleteSponsor = workspace?.sponsors.find((item) => item.id === pendingDeleteSponsorId) ?? null;
  const deleteDetails = useMemo(() => {
    if (!pendingDeleteSponsor) {
      return [];
    }
    return [
      pendingDeleteSponsor.participation.sponsorCode
        ? `Sponsor code: ${pendingDeleteSponsor.participation.sponsorCode}`
        : 'Campaign sponsor record',
      `${pendingDeleteSponsor.sponsoredItems.length} sponsored gift${pendingDeleteSponsor.sponsoredItems.length === 1 ? '' : 's'}`,
      `${pendingDeleteSponsor.interactionCount} communication log entr${pendingDeleteSponsor.interactionCount === 1 ? 'y' : 'ies'}`,
    ];
  }, [pendingDeleteSponsor]);

  const followUpSponsors = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return workspace.sponsors
      .filter((sponsor) => sponsor.recentInteractions.some((interaction) => interaction.followUpAt))
      .slice(0, 5);
  }, [workspace]);

  if (isLoading && !workspace) {
    return <p className="text-muted">Loading Sponsors workspace...</p>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load Sponsors workspace.'}
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

      <div className="campaign-studio__stat-grid campaign-sponsor-stats">
        <StatCard label="Total Sponsors" value={workspace.counts.sponsorCount} />
        <StatCard label="Active Sponsors" value={workspace.counts.activeSponsorshipCount} />
        <StatCard label="Sponsored Gifts" value={workspace.counts.sponsoredItemCount} />
        <StatCard label="Open Sponsor Needs" value={workspace.counts.openSponsorNeedCount} />
      </div>

      <div className="campaign-team-workspace">
        <section className="campaign-team-workspace__section">
          <div className="campaign-team-workspace__section-header">
            <div>
              <h2 className="h5 mb-1">Sponsors Directory</h2>
              <p className="text-muted mb-0">
                Search sponsors, review campaign participation, and open the full sponsor record for notes, gifts, and communication history.
              </p>
            </div>
            {canEditSponsors && showCreateActions ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                onClick={() => {
                  setSelectedSponsorId(null);
                  setIsCreateOpen(true);
                }}
              >
                <i className="bi bi-person-plus" aria-hidden="true" />
                <span>Add Sponsor</span>
              </button>
            ) : null}
          </div>

          <div className="campaign-team-table-toolbar">
            <label className="form-label campaign-team-toolbar__search mb-0">
              <span className="small text-uppercase text-muted fw-semibold">Search Sponsors</span>
              <input
                className="form-control mt-2"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sponsor, organization, email, phone, or sponsor code"
              />
            </label>
          </div>

          <CampaignSponsorTable
            sponsors={filteredSponsors}
            canEdit={canEditSponsors}
            onSelectSponsor={(sponsorId) => {
              setIsCreateOpen(false);
              setSelectedSponsorId(sponsorId);
            }}
            onRequestDeleteSponsor={setPendingDeleteSponsorId}
          />
        </section>

        <section className="campaign-team-workspace__section">
          <div className="campaign-team-workspace__section-header">
            <div>
              <h2 className="h5 mb-1">Operational Snapshot</h2>
              <p className="text-muted mb-0">
                Quick visibility into public registrations, drop-off readiness, and sponsor follow-up needs.
              </p>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12 col-xl-6">
	              <div className="content-card h-100">
	                <h3 className="h6 mb-3">Pending Public Registrations</h3>
	                {pendingRegistrationError ? (
	                  <div className="alert alert-warning py-2" role="alert">
	                    {pendingRegistrationError}
	                  </div>
	                ) : null}
	                {pendingRegistrations.length === 0 ? (
	                  <div className="campaign-studio__empty-note mb-0">No pending public sponsor registrations.</div>
	                ) : (
	                  <div className="campaign-sponsor-list">
	                    {pendingRegistrations.slice(0, 5).map((registration) => (
	                      <div key={registration.id} className="campaign-sponsor-list__item">
                        <div>
                          <strong>{registration.displayName ?? registration.email}</strong>
                          <div className="text-muted small">
                            Expires {formatShortDate(registration.expiresAt)} · {registration.selectedWishlistItemIds.length} selected gift{registration.selectedWishlistItemIds.length === 1 ? '' : 's'}
                          </div>
                        </div>
	                        <span className="campaign-chip campaign-chip-muted">
	                          <i className="bi bi-hourglass-split" aria-hidden="true" />
	                          <span>{registration.status}</span>
	                        </span>
	                        {canEditSponsors && registration.status !== 'VERIFIED' && registration.status !== 'CANCELLED' ? (
	                          <div className="campaign-sponsor-list__actions">
	                            <button
	                              type="button"
	                              className="btn btn-outline-secondary btn-sm"
	                              disabled={isSaving}
	                              onClick={() => {
	                                void onResendPendingRegistration(registration.id).catch(() => undefined);
	                              }}
	                            >
	                              <i className="bi bi-envelope-arrow-up me-1" aria-hidden="true" />
	                              Resend
	                            </button>
	                            <button
	                              type="button"
	                              className="btn btn-outline-secondary btn-sm"
	                              disabled={isSaving}
	                              onClick={() => {
	                                void onVerifyPendingRegistration(registration.id).catch(() => undefined);
	                              }}
	                            >
	                              <i className="bi bi-check2-circle me-1" aria-hidden="true" />
	                              Verify
	                            </button>
	                            <button
	                              type="button"
	                              className="btn btn-outline-danger btn-sm"
	                              disabled={isSaving}
	                              onClick={() => {
	                                void onCancelPendingRegistration(registration.id).catch(() => undefined);
	                              }}
	                            >
	                              <i className="bi bi-x-circle me-1" aria-hidden="true" />
	                              Cancel
	                            </button>
	                          </div>
	                        ) : null}
	                      </div>
	                    ))}
	                  </div>
                )}
              </div>
            </div>
            <div className="col-12 col-xl-6">
              <div className="content-card h-100">
                <h3 className="h6 mb-3">Follow-up Queue</h3>
                {followUpSponsors.length === 0 ? (
                  <div className="campaign-studio__empty-note mb-0">No sponsors currently need follow-up.</div>
                ) : (
                  <div className="campaign-sponsor-list">
                    {followUpSponsors.map((sponsor) => (
                      <button
                        key={sponsor.id}
                        type="button"
                        className="campaign-sponsor-list__item campaign-sponsor-list__item--button"
                        onClick={() => {
                          setIsCreateOpen(false);
                          setSelectedSponsorId(sponsor.id);
                        }}
                      >
                        <div>
                          <strong>{sponsor.displayName}</strong>
                          <div className="text-muted small">{summarizeFollowUp(sponsor.recentInteractions)}</div>
                        </div>
                        <span className="campaign-chip campaign-chip-muted">
                          <i className="bi bi-truck" aria-hidden="true" />
                          <span>{toSponsorDropOffStatusLabel(sponsor.participation.dropOffStatus)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <CampaignSponsorDrawer
        key={selectedSponsor?.id ?? (isCreateOpen ? 'create-sponsor' : 'closed-sponsor')}
        isOpen={isCreateOpen || selectedSponsor !== null}
        canEdit={canEditSponsors}
        isSaving={isSaving}
        sponsor={selectedSponsor}
        interactionsState={selectedSponsor ? interactionsBySponsor[selectedSponsor.id] : undefined}
        onLoadInteractions={onLoadSponsorInteractions}
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

      <ConfirmationModal
        open={pendingDeleteSponsor !== null}
        title={pendingDeleteSponsor ? `Delete ${pendingDeleteSponsor.displayName}?` : 'Delete sponsor?'}
        message="This removes the sponsor from the current campaign and may remove the global sponsor record if it has no other history."
        details={deleteDetails}
        confirmLabel="Delete Sponsor"
        isSubmitting={isDeleting}
        onClose={() => setPendingDeleteSponsorId(null)}
        onConfirm={async () => {
          if (!pendingDeleteSponsor) {
            return;
          }
          setIsDeleting(true);
          try {
            const deleted = await onDeleteSponsor(pendingDeleteSponsor.id);
            if (deleted) {
              if (selectedSponsorId === pendingDeleteSponsor.id) {
                setSelectedSponsorId(null);
                setIsCreateOpen(false);
              }
              setPendingDeleteSponsorId(null);
            }
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="campaign-studio__stat-card">
      <div className="campaign-studio__stat-label">{label}</div>
      <div className="campaign-studio__stat-value">{value}</div>
    </div>
  );
}
