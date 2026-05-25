import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { commitCampaignGift, releaseCampaignGift, searchCampaignGifts } from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem, GiftSearchResult } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { getCampaignSponsorWorkspace } from '@/features/campaigns/api/campaignSponsorWorkspaceApi';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
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
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [commitNotes, setCommitNotes] = useState('');
  const [isSavingGift, setIsSavingGift] = useState(false);
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

  async function runSearch(nextQuery = query) {
    if (!campaignId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await searchCampaignGifts(campaignId, nextQuery);
      setResult(response);
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
          <button type="submit" className="btn btn-secondary" disabled={isLoading}>
            <i className="bi bi-search me-2" aria-hidden="true" />
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {filterChips.length ? (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {filterChips.map((chip) => (
              <span key={chip} className="badge text-bg-light border">{chip}</span>
            ))}
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
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <h2 className="h5 mb-0">Results</h2>
          <span className="text-muted small">{result?.count ?? 0} gift{(result?.count ?? 0) === 1 ? '' : 's'}</span>
        </div>
        {!result || result.items.length === 0 ? (
          <div className="campaign-studio__empty-note">No gifts match the current search.</div>
        ) : (
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
                {result.items.map((item) => (
                  <GiftSearchRow
                    key={item.wishlistItemId}
                    item={item}
                    isSaving={isSavingGift}
                    onCommit={() => openCommitDrawer(item)}
                    onRelease={() => void handleReleaseGift(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
                <p className="text-muted mb-0">Choose the sponsor who is committing to this wishlist item.</p>
              </div>
            </div>
            <label className="form-label">
              Sponsor
              <select
                className="form-select"
                value={selectedSponsorId}
                onChange={(event) => setSelectedSponsorId(event.target.value)}
                required
              >
                <option value="">Select a sponsor</option>
                {sponsors.map((sponsor) => (
                  <option key={sponsor.id} value={sponsor.id}>
                    {sponsor.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Notes
              <textarea
                className="form-control"
                rows={3}
                value={commitNotes}
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
    </div>
  );
}

function GiftSearchRow({
  item,
  isSaving,
  onCommit,
  onRelease,
}: {
  item: GiftSearchItem;
  isSaving: boolean;
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
        {item.recipient?.displayLabel ?? 'Recipient'}
        <div className="text-muted small">{item.recipient?.programRecipientId ?? item.recipient?.recipientKind ?? ''}</div>
      </td>
      <td>
        <span className={`badge ${item.isAvailable ? 'text-bg-success' : 'text-bg-secondary'}`}>
          {item.isAvailable ? 'Available' : item.status}
        </span>
        <div className="text-muted small">{item.sponsorshipStatus}</div>
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

function buildFilterChips(result: GiftSearchResult | null): string[] {
  if (!result) {
    return [];
  }
  const filters = result.parsedFilters;
  const chips: string[] = [];
  if (filters.age_min !== null || filters.age_max !== null) {
    chips.push(`Age ${filters.age_min ?? 'any'}-${filters.age_max ?? 'up'}`);
  }
  if (filters.gender) {
    chips.push(`Gender ${filters.gender}`);
  }
  filters.categories.forEach((category) => chips.push(category.replace('_', ' ')));
  filters.sizes.forEach((size) => chips.push(`Size ${size}`));
  if (filters.max_cost_cents !== null) {
    chips.push(`Under ${(filters.max_cost_cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`);
  }
  return chips;
}
