import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { commitCampaignGift, releaseCampaignGift, searchCampaignGifts } from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem, GiftSearchResult } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { getCampaignSponsorWorkspace } from '@/features/campaigns/api/campaignSponsorWorkspaceApi';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { TablePagination } from '@/shared/ui/TablePagination';
import { WorkspaceSectionHeader } from '@/shared/ui/WorkspaceSectionHeader';
import { clampTablePage } from '@/shared/ui/tablePaginationModel';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
import type { ReportExportPayload } from '@/features/reports/model/reportExport';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/gifts/ui/giftWorkflow.css';

export function GiftSearchPage() {
  const { campaignId = null } = useParams();
  const { campaigns, selectedCampaignId, selectCampaign } = useCampaigns();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<GiftSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sponsors, setSponsors] = useState<CampaignSponsor[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftSearchItem | null>(null);
  const [detailsGift, setDetailsGift] = useState<GiftSearchItem | null>(null);
  const [pendingReleaseGift, setPendingReleaseGift] = useState<GiftSearchItem | null>(null);
  const [selectedSponsorDetailsId, setSelectedSponsorDetailsId] = useState<string | null>(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [sponsorSearch, setSponsorSearch] = useState('');
  const [commitNotes, setCommitNotes] = useState('');
  const [isSavingGift, setIsSavingGift] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    void runSearch('');
    void loadSponsors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const filterChips = useMemo(() => buildFilterChips(result), [result]);
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === selectedSponsorId) ?? null;
  const selectedSponsorDetails = sponsors.find((sponsor) => sponsor.id === selectedSponsorDetailsId) ?? null;
  const safePage = clampTablePage(page, result?.items.length ?? 0, pageSize);
  const pagedItems = useMemo(() => {
    const items = result?.items ?? [];
    return items.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [pageSize, result?.items, safePage]);
  const giftSearchExport = useMemo(
    () => buildGiftSearchExport(campaign?.name ?? 'Campaign', result),
    [campaign?.name, result]
  );

  async function runSearch(nextQuery = query) {
    if (!campaignId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await searchCampaignGifts(campaignId, nextQuery);
      setResult(response);
      setPage(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to search gifts.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSponsors() {
    if (!campaignId) {
      return;
    }
    try {
      const workspace = await getCampaignSponsorWorkspace(campaignId);
      setSponsors(workspace.sponsors.filter((sponsor) => sponsor.participation.status !== 'CANCELLED'));
    } catch {
      setSponsors([]);
    }
  }

  function openCommitDrawer(item: GiftSearchItem) {
    setSelectedGift(item);
    setSelectedSponsorId('');
    setSponsorSearch('');
    setCommitNotes('');
    setActionMessage(null);
    setError(null);
  }

  async function handleCommitGift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !selectedGift || !selectedSponsorId) {
      return;
    }
    setIsSavingGift(true);
    setError(null);
    try {
      await commitCampaignGift(campaignId, selectedGift.wishlistItemId, selectedSponsorId, commitNotes);
      setSelectedGift(null);
      setActionMessage('Gift committed.');
      await runSearch();
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Unable to commit gift.');
    } finally {
      setIsSavingGift(false);
    }
  }

  async function handleReleaseGift(item: GiftSearchItem) {
    if (!campaignId) {
      return;
    }
    setIsSavingGift(true);
    setError(null);
    try {
      await releaseCampaignGift(campaignId, item.wishlistItemId);
      setActionMessage('Gift released.');
      await runSearch();
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : 'Unable to release gift.');
    } finally {
      setIsSavingGift(false);
    }
  }

  function handleClearSearch() {
    setQuery('');
    void runSearch('');
  }

  function handleRemoveFilterChip(chip: GiftSearchFilterChip) {
    const nextQuery = removeFilterFromQuery(query || result?.parsedFilters.query || '', chip).trim();
    setQuery(nextQuery);
    void runSearch(nextQuery);
  }

  if (!campaignId) {
    return null;
  }

  return (
    <div className="campaign-studio-page gift-workflow-page">
      <div className="campaign-studio-page__header">
        <div>
          <div className="text-uppercase small text-muted fw-semibold mb-1">Gift Workflow</div>
          <h1 className="h3 mb-1">Gift Search</h1>
          <p className="text-muted mb-0">
            {campaign?.name ?? 'Campaign'} gift discovery for sponsor matching and staff operations.
          </p>
        </div>
      </div>

      <section className="content-card">
        <form
          className="d-flex flex-column flex-lg-row gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <label className="visually-hidden" htmlFor="gift-search-query">Search gifts</label>
          <input
            id="gift-search-query"
            className="form-control"
            placeholder="Try: coats for girls age 8, gift cards under $25, toys for teens"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isLoading || (!query && !result?.parsedFilters.query)}
            onClick={handleClearSearch}
          >
            <i className="bi bi-x-circle me-2" aria-hidden="true" />
            Clear
          </button>
          <button type="submit" className="btn btn-secondary" disabled={isLoading}>
            <i className="bi bi-search me-2" aria-hidden="true" />
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {filterChips.length ? (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            {filterChips.map((chip) => (
              <button
                key={`${chip.kind}-${chip.value ?? chip.label}`}
                type="button"
                className="badge text-bg-light border d-inline-flex align-items-center gap-1"
                onClick={() => handleRemoveFilterChip(chip)}
                aria-label={`Remove ${chip.label} filter`}
              >
                <span>{chip.label}</span>
                <i className="bi bi-x" aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={handleClearSearch}>
              Clear all
            </button>
          </div>
        ) : null}

        {result?.parsedFilters.warnings.length ? (
          <div className="alert alert-warning mt-3 mb-0" role="alert">
            {result.parsedFilters.warnings.join(' ')}
          </div>
        ) : null}
      </section>

      {actionMessage ? <div className="alert alert-success" role="status">{actionMessage}</div> : null}
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

      <section className="content-card">
        <WorkspaceSectionHeader
          title="Results"
          meta={<span className="text-muted small">{result?.count ?? 0} gift{(result?.count ?? 0) === 1 ? '' : 's'}</span>}
          actions={<ReportExportActions payload={giftSearchExport} formats={['pdf', 'excel']} />}
        />
        {!result || result.items.length === 0 ? (
          <div className="campaign-studio__empty-note">No gifts match the current search.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Recipient</th>
                    <th>Workflow</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item) => (
                    <GiftSearchRow
                      key={item.wishlistItemId}
                      item={item}
                      isSaving={isSavingGift}
                      onOpenDetails={() => setDetailsGift(item)}
                      onOpenSponsor={item.sponsor ? () => setSelectedSponsorDetailsId(item.sponsor?.id ?? null) : undefined}
                      onCommit={() => openCommitDrawer(item)}
                      onRelease={() => setPendingReleaseGift(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={safePage}
              pageSize={pageSize}
              totalItems={result.items.length}
              itemLabel="gifts"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>

      <CampaignStudioDrawer
        isOpen={selectedGift !== null}
        title="Commit Gift"
        description={selectedGift ? selectedGift.description : undefined}
        onClose={() => setSelectedGift(null)}
        width="regular"
      >
        <form className="campaign-team-drawer__stack" onSubmit={handleCommitGift}>
          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">Sponsor</h4>
                <p className="text-muted mb-0">Find and select the sponsor committing to this wishlist item.</p>
              </div>
            </div>
            <label className="form-label mb-0 w-100">
              Search sponsors
              <div className="input-group mt-2">
                <span className="input-group-text">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  className="form-control"
                  list="gift-commit-sponsor-options"
                  value={sponsorSearch}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSponsorSearch(nextValue);
                    const matchedSponsor = findSponsorBySearchValue(sponsors, nextValue);
                    if (matchedSponsor) {
                      setSelectedSponsorId(matchedSponsor.id);
                    }
                  }}
                  placeholder="Search name, organization, email, phone, or code"
                />
                <datalist id="gift-commit-sponsor-options">
                  {sponsors.map((sponsor) => (
                    <option key={sponsor.id} value={sponsor.displayName}>
                      {formatSponsorSummary(sponsor)}
                    </option>
                  ))}
                </datalist>
                {sponsorSearch ? (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setSponsorSearch('')}>
                    <i className="bi bi-x-lg" aria-hidden="true" />
                    <span className="visually-hidden">Clear sponsor search</span>
                  </button>
                ) : null}
              </div>
            </label>
            {selectedSponsor ? (
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded px-3 py-2 bg-light">
                <div>
                  <div className="small text-uppercase text-muted fw-semibold">Selected Sponsor</div>
                  <div className="fw-semibold">{selectedSponsor.displayName}</div>
                  <div className="text-muted small">{formatSponsorSummary(selectedSponsor)}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    setSelectedSponsorId('');
                    setSponsorSearch('');
                  }}
                  aria-label={`Clear selected sponsor ${selectedSponsor.displayName}`}
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>

          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">Notes</h4>
                <p className="text-muted mb-0">Optional notes for this commitment.</p>
              </div>
            </div>
            <label className="form-label w-100">
              <textarea
                className="form-control"
                rows={3}
                value={commitNotes}
                placeholder="Add any sponsor, substitution, or delivery notes"
                onChange={(event) => setCommitNotes(event.target.value)}
              />
            </label>
          </section>
          <div className="campaign-team-drawer__actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedGift(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-secondary" disabled={!selectedSponsorId || isSavingGift}>
              <i className="bi bi-check2-circle me-2" aria-hidden="true" />
              {isSavingGift ? 'Committing...' : 'Commit Gift'}
            </button>
          </div>
        </form>
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={detailsGift !== null}
        title={detailsGift?.recipient?.displayLabel ?? detailsGift?.recipient?.publicLabel ?? 'Gift Details'}
        description={detailsGift?.description}
        onClose={() => setDetailsGift(null)}
        width="regular"
      >
        {detailsGift ? (
          <GiftDetailsDrawerContent item={detailsGift} />
        ) : null}
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={selectedSponsorDetailsId !== null}
        title="Sponsor Details"
        description={selectedSponsorDetails?.displayName ?? 'Sponsor'}
        onClose={() => setSelectedSponsorDetailsId(null)}
        width="regular"
      >
        {selectedSponsorDetails ? (
          <SponsorDetailsDrawerContent sponsor={selectedSponsorDetails} />
        ) : (
          <div className="campaign-studio__empty-note">Sponsor details are not available yet.</div>
        )}
      </CampaignStudioDrawer>

      <ConfirmationModal
        open={pendingReleaseGift !== null}
        title="Release Sponsor From Gift"
        message="This will remove the sponsor commitment from this gift and make the gift available again."
        detailsHeading="This will release"
        details={pendingReleaseGift ? buildReleaseDetails(pendingReleaseGift) : []}
        confirmLabel={isSavingGift ? 'Releasing...' : 'Release Sponsor'}
        tone="danger"
        isSubmitting={isSavingGift}
        onClose={() => {
          if (!isSavingGift) {
            setPendingReleaseGift(null);
          }
        }}
        onConfirm={async () => {
          if (!pendingReleaseGift) {
            return;
          }
          await handleReleaseGift(pendingReleaseGift);
          setPendingReleaseGift(null);
        }}
      />
    </div>
  );
}

interface GiftSearchFilterChip {
  kind: 'age' | 'gender' | 'category' | 'size' | 'cost';
  label: string;
  value?: string;
}

function GiftSearchRow({
  item,
  isSaving,
  onOpenDetails,
  onOpenSponsor,
  onCommit,
  onRelease,
}: {
  item: GiftSearchItem;
  isSaving: boolean;
  onOpenDetails: () => void;
  onOpenSponsor?: () => void;
  onCommit: () => void;
  onRelease: () => void;
}) {
  return (
    <tr>
      <td>
        <strong>{item.description}</strong>
        <div className="text-muted small">
          {item.category ?? item.itemType}{item.size ? ` · ${item.size}` : ''}
        </div>
      </td>
      <td>
        <button type="button" className="btn btn-link btn-sm p-0 text-start" onClick={onOpenDetails}>
          {item.recipient?.displayLabel ?? item.recipient?.publicLabel ?? 'Recipient'}
        </button>
        <div className="text-muted small">{formatRecipientSummary(item.recipient)}</div>
        {item.recipient?.groupLabel ? (
          <div className="text-muted small">
            <i className="bi bi-people me-1" aria-hidden="true" />
            {item.recipient.groupLabel}
          </div>
        ) : null}
      </td>
      <td>
        <span className={`badge ${item.isAvailable ? 'text-bg-success' : 'text-bg-secondary'}`}>
          {item.isAvailable ? 'Available' : item.status}
        </span>
        <div className="text-muted small">
          {item.sponsor ? (
            <>
              Sponsor:{' '}
              <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onOpenSponsor}>
                {item.sponsor.displayName}
              </button>
            </>
          ) : (
            item.sponsorshipStatus
          )}
        </div>
      </td>
      <td>
        <div className="text-muted small">
          Qty {item.qtyRemaining}/{item.qtyRequested} remaining
          {item.estimatedCostCents ? ` · ${(item.estimatedCostCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}` : ''}
        </div>
        {item.labelCode ? <div className="text-muted small">Label {item.labelCode}</div> : null}
      </td>
      <td>
        {item.isAvailable ? (
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCommit} disabled={isSaving}>
            <i className="bi bi-bag-check me-1" aria-hidden="true" />
            Commit
          </button>
        ) : item.sponsorshipStatus === 'SPONSORED' ? (
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={onRelease} disabled={isSaving}>
            <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
            Release
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function GiftDetailsDrawerContent({ item }: { item: GiftSearchItem }) {
  const recipient = item.recipient;
  return (
    <div className="campaign-team-drawer__stack">
      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Recipient</h4>
            <p className="text-muted mb-0">Recipient context for matching and gift selection.</p>
          </div>
        </div>
        <div className="row g-3">
          <DetailField label="Name" value={recipient?.displayLabel ?? recipient?.publicLabel ?? 'Recipient'} />
          <DetailField label="Recipient ID" value={recipient?.programRecipientId ?? 'Not assigned'} />
          <DetailField label="Recipient Type" value={formatEnumLabel(recipient?.recipientKind)} />
          <DetailField label="Program" value={formatEnumLabel(recipient?.programType)} />
          <DetailField label="Family/Group" value={recipient?.groupLabel ?? 'Not set'} />
          <DetailField label="Age" value={formatRecipientAge(recipient)} />
          <DetailField label="Gender" value={formatGender(recipient?.gender)} />
        </div>
      </section>

      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Gift</h4>
            <p className="text-muted mb-0">Requested item details and matching notes.</p>
          </div>
        </div>
        <div className="row g-3">
          <DetailField label="Description" value={item.description} wide />
          <DetailField label="Category" value={item.category ?? 'Not set'} />
          <DetailField label="Type" value={formatEnumLabel(item.itemType)} />
          <DetailField label="Size" value={item.size ?? 'Not set'} />
          <DetailField label="Priority" value={formatEnumLabel(item.priority)} />
          <DetailField label="Estimated Cost" value={formatCurrency(item.estimatedCostCents)} />
          <DetailField label="Quantity Requested" value={String(item.qtyRequested)} />
          <DetailField label="Quantity Remaining" value={String(item.qtyRemaining)} />
          <DetailField label="Substitutions" value={item.allowSubstitute ? 'Allowed' : 'Do not substitute'} />
          <DetailField label="Label" value={item.labelCode ?? 'Not assigned'} />
          <DetailField label="Recipient Note" value={item.recipientNote ?? 'No recipient note'} wide />
          <DetailField label="Staff Notes" value={item.notes ?? 'No staff notes'} wide />
        </div>
      </section>

      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Workflow</h4>
            <p className="text-muted mb-0">Current availability and sponsorship status.</p>
          </div>
        </div>
        <div className="row g-3">
          <DetailField label="Status" value={formatEnumLabel(item.status)} />
          <DetailField label="Availability" value={item.isAvailable ? 'Available' : 'Not available'} />
          <DetailField label="Sponsorship" value={formatEnumLabel(item.sponsorshipStatus)} />
          <DetailField label="Fulfilled Qty" value={String(item.qtyFulfilled)} />
        </div>
      </section>
    </div>
  );
}

function SponsorDetailsDrawerContent({ sponsor }: { sponsor: CampaignSponsor }) {
  return (
    <div className="campaign-team-drawer__stack">
      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Contact</h4>
            <p className="text-muted mb-0">Sponsor identity and contact details.</p>
          </div>
        </div>
        <div className="row g-3">
          <DetailField label="Name" value={sponsor.displayName} />
          <DetailField label="Organization" value={sponsor.organizationName ?? 'Not set'} />
          <DetailField label="Email" value={sponsor.email ?? 'Not set'} />
          <DetailField label="Phone" value={sponsor.phone ?? 'Not set'} />
          <DetailField label="Preferred Contact" value={formatEnumLabel(sponsor.preferredContact)} />
          <DetailField label="Do Not Contact" value={sponsor.doNotContact ? 'Yes' : 'No'} />
          <DetailField label="Address" value={formatSponsorAddress(sponsor)} wide />
        </div>
      </section>

      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Campaign Participation</h4>
            <p className="text-muted mb-0">Current sponsor commitment and drop-off state.</p>
          </div>
        </div>
        <div className="row g-3">
          <DetailField label="Sponsor Code" value={sponsor.participation.sponsorCode ?? 'Not assigned'} />
          <DetailField label="Status" value={formatEnumLabel(sponsor.participation.status)} />
          <DetailField label="Interest" value={formatEnumLabel(sponsor.participation.interestStatus)} />
          <DetailField label="Drop-off" value={formatEnumLabel(sponsor.participation.dropOffStatus)} />
          <DetailField label="Last Contacted" value={formatDate(sponsor.lastContactedAt)} />
          <DetailField label="Sponsored Gifts" value={String(sponsor.sponsoredItemCount)} />
          <DetailField label="Notes" value={sponsor.participation.notes ?? sponsor.notes ?? 'No notes'} wide />
        </div>
      </section>

      <section className="campaign-team-drawer__section">
        <div className="campaign-team-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Sponsored Gifts</h4>
            <p className="text-muted mb-0">Gifts currently linked to this sponsor.</p>
          </div>
        </div>
        {sponsor.sponsoredItems.length === 0 ? (
          <div className="campaign-studio__empty-note mb-0">No gifts linked to this sponsor.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Gift</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sponsor.sponsoredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.recipient?.displayLabel ?? 'Unknown recipient'}
                      <div className="text-muted small">{item.recipient?.programRecipientId ?? 'No recipient ID'}</div>
                    </td>
                    <td>
                      {item.gift?.description ?? 'Unknown gift'}
                      <div className="text-muted small">
                        {[item.gift?.category, item.gift?.size].filter(Boolean).join(' · ') || 'No details'}
                      </div>
                    </td>
                    <td>{formatEnumLabel(item.gift?.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DetailField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-12' : 'col-md-6'}>
      <div className="small text-uppercase text-muted fw-semibold">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function formatRecipientAge(recipient: GiftSearchItem['recipient']) {
  if (!recipient || recipient.age === null) {
    return 'Not set';
  }
  const unit = recipient.ageUnit === 'MONTHS' ? 'mo' : 'yr';
  return `${recipient.age} ${unit}${recipient.age === 1 ? '' : 's'}`;
}

function formatRecipientSummary(recipient: GiftSearchItem['recipient']) {
  if (!recipient) {
    return '';
  }
  return [
    recipient.programRecipientId ?? formatEnumLabel(recipient.recipientKind),
    formatRecipientAge(recipient),
    formatGender(recipient.gender),
  ].filter((value) => value && value !== 'Not set').join(' · ');
}

function formatGender(value: string | null | undefined) {
  switch (value) {
    case 'F':
      return 'Female';
    case 'M':
      return 'Male';
    case 'X':
      return 'Nonbinary';
    case 'U':
      return 'Unknown';
    default:
      return 'Not set';
  }
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Not set';
  }
  return (value / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSponsorAddress(sponsor: CampaignSponsor) {
  const street = [sponsor.addressLine1, sponsor.addressLine2].filter(Boolean).join(', ');
  const cityState = [sponsor.city, sponsor.state].filter(Boolean).join(', ');
  return [street, cityState, sponsor.postalCode].filter(Boolean).join(' ') || 'Not set';
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

function findSponsorBySearchValue(sponsors: CampaignSponsor[], value: string) {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }
  return sponsors.find((sponsor) => sponsor.displayName.trim().toLowerCase() === normalizedValue) ?? null;
}

function formatSponsorSummary(sponsor: CampaignSponsor) {
  return [
    sponsor.organizationName,
    sponsor.email,
    sponsor.phone,
    sponsor.participation.sponsorCode ? `Code ${sponsor.participation.sponsorCode}` : null,
    `${sponsor.sponsoredItemCount} gift${sponsor.sponsoredItemCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ') || 'No sponsor details';
}

function buildReleaseDetails(item: GiftSearchItem) {
  return [
    `Sponsor: ${item.sponsor?.displayName ?? 'Unknown sponsor'}`,
    `Gift: ${item.description}`,
    `Recipient: ${item.recipient?.displayLabel ?? item.recipient?.publicLabel ?? 'Recipient'}`,
    'The gift will return to available inventory for sponsor matching.',
  ];
}

function buildGiftSearchExport(campaignName: string, result: GiftSearchResult | null): ReportExportPayload {
  const searchLabel = result?.parsedFilters.query ? `Search: ${result.parsedFilters.query}` : 'All gifts';
  return {
    title: 'Gift Search Results',
    subtitle: `${campaignName} | ${searchLabel}`,
    fileName: `${campaignName}-gift-search-results`,
    sheets: [
      {
        name: 'Gift Search',
        columns: [
          { key: 'gift', label: 'Gift', pdfWidthWeight: 1.8 },
          { key: 'category', label: 'Category' },
          { key: 'size', label: 'Size', pdfWidthWeight: 0.8 },
          { key: 'recipient', label: 'Recipient', pdfWidthWeight: 1.3 },
          { key: 'recipientId', label: 'Recipient ID', pdfWidthWeight: 0.9 },
          { key: 'age', label: 'Age', pdfWidthWeight: 0.6 },
          { key: 'gender', label: 'Gender', pdfWidthWeight: 0.7 },
          { key: 'family', label: 'Family/Group', pdfWidthWeight: 1.1 },
          { key: 'status', label: 'Status', pdfWidthWeight: 0.9 },
          { key: 'sponsor', label: 'Sponsor', pdfWidthWeight: 1.3 },
          { key: 'quantity', label: 'Qty', pdfWidthWeight: 0.7 },
          { key: 'label', label: 'Label', pdfWidthWeight: 0.8 },
          { key: 'notes', label: 'Notes', pdfWidthWeight: 1.6 },
        ],
        rows: (result?.items ?? []).map((item) => ({
          gift: item.description,
          category: item.category ?? formatEnumLabel(item.itemType),
          size: item.size ?? '',
          recipient: item.recipient?.displayLabel ?? item.recipient?.publicLabel ?? '',
          recipientId: item.recipient?.programRecipientId ?? '',
          age: formatRecipientAge(item.recipient),
          gender: formatGender(item.recipient?.gender),
          family: item.recipient?.groupLabel ?? '',
          status: item.isAvailable ? 'Available' : formatEnumLabel(item.status),
          sponsor: item.sponsor?.displayName ?? '',
          quantity: `${item.qtyRemaining}/${item.qtyRequested}`,
          label: item.labelCode ?? '',
          notes: [item.recipientNote, item.notes].filter(Boolean).join(' | '),
        })),
      },
    ],
  };
}

function buildFilterChips(result: GiftSearchResult | null): GiftSearchFilterChip[] {
  if (!result) {
    return [];
  }
  const filters = result.parsedFilters;
  const chips: GiftSearchFilterChip[] = [];
  if (filters.age_min !== null || filters.age_max !== null) {
    chips.push({ kind: 'age', label: `Age ${filters.age_min ?? 'any'}-${filters.age_max ?? 'up'}` });
  }
  if (filters.gender) {
    chips.push({ kind: 'gender', label: `Gender ${filters.gender}`, value: filters.gender });
  }
  filters.categories.forEach((category) => chips.push({ kind: 'category', label: category.replace('_', ' '), value: category }));
  filters.sizes.forEach((size) => chips.push({ kind: 'size', label: `Size ${size}`, value: size }));
  if (filters.max_cost_cents !== null) {
    chips.push({
      kind: 'cost',
      label: `Under ${(filters.max_cost_cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`,
    });
  }
  return chips;
}

function removeFilterFromQuery(query: string, chip: GiftSearchFilterChip): string {
  let nextQuery = query;

  switch (chip.kind) {
    case 'age':
      nextQuery = nextQuery
        .replace(/\b(?:ages?|between)\s+\d{1,2}\s*(?:-|to|and)\s*\d{1,2}\b/gi, ' ')
        .replace(/\b\d{1,2}\s*(?:-|to)\s*\d{1,2}\s*(?:year|yr|yo|y\/o|years old|old)?\b/gi, ' ')
        .replace(/\bage\s+\d{1,2}\b/gi, ' ')
        .replace(/\b\d{1,2}\s*(?:year|yr|yo|y\/o|years old|old)\b/gi, ' ')
        .replace(/\b(?:toddler|toddlers|teen|teens|teenager|teenagers|infant|baby|babies)\b/gi, ' ');
      break;
    case 'gender':
      nextQuery = nextQuery.replace(/\b(?:girl|girls|female|boy|boys|male|nonbinary|non-binary|gender neutral|any gender)\b/gi, ' ');
      break;
    case 'category':
      nextQuery = removeCategoryTerms(nextQuery, chip.value ?? chip.label);
      break;
    case 'size':
      if (chip.value) {
        nextQuery = nextQuery
          .replace(new RegExp(`\\bsize\\s+${escapeRegExp(chip.value)}\\b`, 'gi'), ' ')
          .replace(new RegExp(`\\b${escapeRegExp(chip.value)}\\b`, 'gi'), ' ');
      }
      break;
    case 'cost':
      nextQuery = nextQuery
        .replace(/\b(?:under|below|less than|max(?:imum)?|up to)\s+\$?\d{1,4}\b/gi, ' ')
        .replace(/\b(?:over|above|more than|min(?:imum)?|at least)\s+\$?\d{1,4}\b/gi, ' ')
        .replace(/\$?\d{1,4}\s*(?:-|to)\s*\$?\d{1,4}/gi, ' ');
      break;
  }

  return nextQuery.replace(/\s+/g, ' ').trim();
}

function removeCategoryTerms(query: string, category: string): string {
  const categoryTerms: Record<string, string[]> = {
    clothing: ['clothes', 'clothing', 'shirt', 'shirts', 'pants', 'jeans', 'jacket', 'coat', 'shoes', 'sneakers', 'boots', 'socks', 'hat', 'gloves', 'hoodie', 'sweater', 'pajamas', 'pjs', 'underwear'],
    coat: ['coat', 'coats', 'jacket', 'jackets', 'winter coat', 'warm coat', 'parka', 'hoodie', 'hoodies'],
    toy: ['toy', 'toys', 'lego', 'legos', 'blocks', 'building blocks', 'doll', 'dolls', 'barbie', 'truck', 'trucks', 'car', 'cars', 'game', 'games', 'board game', 'puzzle', 'puzzles', 'action figure', 'dinosaur', 'stuffed animal', 'plush', 'play set', 'playset', 'craft', 'crafts', 'art kit'],
    book: ['book', 'books', 'reading', 'novel', 'comic', 'journal'],
    gift_card: ['gift card', 'gift cards', 'voucher', 'vouchers'],
    essential: ['essential', 'essentials', 'hygiene', 'toiletry', 'toiletries', 'blanket', 'blankets', 'bedding', 'towel', 'diapers', 'wipes', 'soap', 'shampoo', 'toothbrush', 'toothpaste'],
    electronics: ['electronic', 'electronics', 'headphones', 'earbuds', 'tablet', 'speaker', 'bluetooth', 'charger', 'gaming', 'video game', 'controller'],
    sports: ['sport', 'sports', 'basketball', 'football', 'soccer', 'baseball', 'softball', 'volleyball', 'cleats', 'ball', 'bike', 'bicycle', 'scooter', 'skateboard'],
    art: ['art', 'arts', 'creative', 'craft', 'crafts', 'drawing', 'paint', 'painting', 'markers', 'crayons', 'colored pencils', 'sketchbook', 'art kit'],
    beauty: ['beauty', 'makeup', 'cosmetics', 'skin care', 'skincare', 'perfume', 'cologne', 'nail', 'nails', 'hair'],
  };
  return (categoryTerms[category] ?? [category.replace('_', ' ')]).reduce((currentQuery, term) => {
    return currentQuery.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'), ' ');
  }, query);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
