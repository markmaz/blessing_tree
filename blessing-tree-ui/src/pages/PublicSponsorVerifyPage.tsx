import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { buildPublicCampaignSponsorPath } from '@/app/routes';
import {
  commitVerifiedPublicSponsorGifts,
  verifyPublicSponsorRegistration,
} from '@/features/campaigns/api/publicSponsorApi';
import type {
  PublicSponsorAvailableItem,
  PublicSponsorVerificationResult,
} from '@/features/campaigns/model/publicSponsorTypes';
import { formatShortDate } from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { searchPublicCampaignGifts } from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem, GiftSearchResult } from '@/features/gifts/model/giftSearchTypes';
import '@/features/campaigns/ui/publicSponsors.css';

export function PublicSponsorVerifyPage() {
  const { publicSlug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [result, setResult] = useState<PublicSponsorVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [giftSearchQuery, setGiftSearchQuery] = useState('');
  const [giftSearchResult, setGiftSearchResult] = useState<GiftSearchResult | null>(null);
  const [isSearchingGifts, setIsSearchingGifts] = useState(false);
  const [giftSearchError, setGiftSearchError] = useState<string | null>(null);
  const [selectedWishlistItemIds, setSelectedWishlistItemIds] = useState<string[]>([]);
  const [isCommittingGifts, setIsCommittingGifts] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function verify() {
      if (!token) {
        setError('Verification token is missing.');
        setIsLoading(false);
        return;
      }
      try {
        const response = await verifyPublicSponsorRegistration(publicSlug, token);
        if (!isActive) {
          return;
        }
        setResult(response);
      } catch (verifyError) {
        if (!isActive) {
          return;
        }
        setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify sponsor registration.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void verify();
    return () => {
      isActive = false;
    };
  }, [publicSlug, token]);

  const runGiftSearch = useCallback(async (nextQuery = giftSearchQuery) => {
    if (!publicSlug) {
      return;
    }
    setIsSearchingGifts(true);
    setGiftSearchError(null);
    try {
      const response = await searchPublicCampaignGifts(publicSlug, nextQuery);
      setGiftSearchResult(response);
    } catch (searchError) {
      setGiftSearchError(searchError instanceof Error ? searchError.message : 'Unable to search gifts.');
    } finally {
      setIsSearchingGifts(false);
    }
  }, [giftSearchQuery, publicSlug]);

  const sponsoredItemCount = result?.sponsor.sponsoredItems.length ?? 0;
  const selectionLimit = result?.selectionLimit ?? 0;
  const remainingSelectionCount = Math.max(selectionLimit - sponsoredItemCount, 0);
  const visibleGiftItems = giftSearchResult?.items.map(mapGiftSearchItemToPublicSponsorItem) ?? [];

  useEffect(() => {
    if (!result || giftSearchResult) {
      return;
    }
    void runGiftSearch('');
  }, [giftSearchResult, result, runGiftSearch]);

  function toggleItem(itemId: string) {
    setSelectedWishlistItemIds((current) => {
      const alreadySelected = current.includes(itemId);
      if (alreadySelected) {
        return current.filter((value) => value !== itemId);
      }
      if (current.length >= remainingSelectionCount) {
        return current;
      }
      return [...current, itemId];
    });
  }

  async function handleCommitGifts() {
    if (!result || selectedWishlistItemIds.length === 0) {
      return;
    }
    setIsCommittingGifts(true);
    setCommitError(null);
    setCommitMessage(null);
    try {
      const response = await commitVerifiedPublicSponsorGifts(publicSlug, token, selectedWishlistItemIds);
      setResult(response);
      setSelectedWishlistItemIds([]);
      setGiftSearchResult(null);
      setCommitMessage(response.message);
    } catch (commitGiftsError) {
      setCommitError(commitGiftsError instanceof Error ? commitGiftsError.message : 'Unable to reserve selected gifts.');
    } finally {
      setIsCommittingGifts(false);
    }
  }

  return (
    <div className="public-sponsor-shell">
      <div className="public-sponsor-layout">
        <section className="public-sponsor-hero">
          <div className="public-sponsor-brand-row">
            <img
              src="/blessing_tree_logo_transparent_v3.png"
              alt="Blessing Tree"
              className="public-sponsor-logo"
            />
            <div>
              <div className="text-uppercase small text-muted fw-semibold mb-2">Blessing Tree Sponsor Confirmation</div>
              <h1 className="h3 mb-1">{result?.campaign.name ?? 'Sponsor Signup'}</h1>
              <p className="text-muted mb-0">
                {result?.campaign.seasonTheme ? `${result.campaign.seasonTheme} · ` : ''}
                Verify your signup and choose gifts to sponsor.
              </p>
            </div>
          </div>
        </section>

        <section className="public-sponsor-card">
          {isLoading ? (
            <>
              <h1 className="h4 mb-2">Verifying Sponsor Signup</h1>
              <p className="text-muted mb-0">Please wait while we reserve your selected gifts.</p>
            </>
          ) : error ? (
            <>
              <h1 className="h4 mb-2">Verification Could Not Be Completed</h1>
              <div className="alert alert-danger" role="alert">{error}</div>
              <Link to={buildPublicCampaignSponsorPath(publicSlug)} className="btn btn-outline-secondary">
                <i className="bi bi-arrow-left-circle me-2" aria-hidden="true" />
                Back to Sponsor Signup
              </Link>
            </>
          ) : result ? (
            <>
              <div className="text-uppercase small text-muted fw-semibold mb-2">Sponsor Signup Verified</div>
              <h1 className="h4 mb-2">{result.campaign.name}</h1>
              <p className="text-muted mb-3">{result.message}</p>
              <div className="public-sponsor-item__meta mb-4">
                <span className="public-sponsor-badge">
                  <i className="bi bi-envelope-check" aria-hidden="true" />
                  <span>{result.registration.email}</span>
                </span>
                {result.giftDeadline ? (
                  <span className="public-sponsor-badge">
                    <i className="bi bi-gift" aria-hidden="true" />
                    <span>Gift deadline {formatShortDate(result.giftDeadline)}</span>
                  </span>
                ) : null}
              </div>

              <div className="public-sponsor-card">
                <h2 className="h6 mb-3">Reserved Gifts</h2>
                {result.sponsor.sponsoredItems.length === 0 ? (
                  <div className="campaign-studio__empty-note">No gifts have been selected yet.</div>
                ) : (
                  <div className="public-sponsor-item-list">
                    {result.sponsor.sponsoredItems.map((item) => (
                      <div key={item.id} className="public-sponsor-item public-sponsor-item--selected">
                        <strong>{item.gift?.description ?? 'Gift item'}</strong>
                        <div className="text-muted small">
                          {item.recipient?.displayLabel ?? 'Recipient'}
                          {item.recipient?.programRecipientId ? ` · ${item.recipient.programRecipientId}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="public-sponsor-card mt-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h2 className="h6 mb-1">Choose Gifts</h2>
                    <p className="text-muted mb-0">
                      Search naturally, then reserve up to {selectionLimit} total gift{selectionLimit === 1 ? '' : 's'} for this campaign.
                    </p>
                  </div>
                  <span className="public-sponsor-badge">
                    <i className="bi bi-bag-heart" aria-hidden="true" />
                    <span>{sponsoredItemCount + selectedWishlistItemIds.length} of {selectionLimit} selected</span>
                  </span>
                </div>

                {remainingSelectionCount === 0 ? (
                  <div className="campaign-studio__empty-note">You have reached this campaign’s gift sponsorship limit.</div>
                ) : (
                  <>
                    <form
                      className="d-flex flex-column flex-md-row gap-2 mb-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void runGiftSearch();
                      }}
                    >
                      <label className="visually-hidden" htmlFor="verified-public-gift-search">Search available gifts</label>
                      <input
                        id="verified-public-gift-search"
                        className="form-control"
                        placeholder="Try: coats for girls age 8, toys for teens"
                        value={giftSearchQuery}
                        onChange={(event) => setGiftSearchQuery(event.target.value)}
                      />
                      <button type="submit" className="btn btn-outline-secondary" disabled={isSearchingGifts}>
                        <i className="bi bi-search me-2" aria-hidden="true" />
                        {isSearchingGifts ? 'Searching...' : 'Search'}
                      </button>
                    </form>

                    {giftSearchResult ? (
                      <div className="public-sponsor-item__meta mb-3">
                        {buildPublicFilterChips(giftSearchResult).map((chip) => (
                          <span key={chip} className="public-sponsor-badge">
                            <i className="bi bi-funnel" aria-hidden="true" />
                            <span>{chip}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {commitMessage ? <div className="alert alert-success" role="status">{commitMessage}</div> : null}
                    {commitError ? <div className="alert alert-danger" role="alert">{commitError}</div> : null}
                    {giftSearchError ? <div className="alert alert-warning" role="alert">{giftSearchError}</div> : null}

                    {visibleGiftItems.length === 0 ? (
                      <div className="campaign-studio__empty-note">No gifts are currently available for self-service sponsorship.</div>
                    ) : (
                      <div className="public-sponsor-item-list">
                        {visibleGiftItems.map((item) => {
                          const isSelected = selectedWishlistItemIds.includes(item.wishlistItemId);
                          const selectionDisabled = !isSelected && selectedWishlistItemIds.length >= remainingSelectionCount;
                          return (
                            <label
                              key={item.wishlistItemId}
                              className={`public-sponsor-item ${isSelected ? 'public-sponsor-item--selected' : ''}`}
                            >
                              <div className="public-sponsor-item__row">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={selectionDisabled || isCommittingGifts}
                                  onChange={() => toggleItem(item.wishlistItemId)}
                                />
                                <div>
                                  <strong>{item.description}</strong>
                                  <div className="text-muted small">
                                    {item.recipient?.displayLabel ?? 'Gift recipient'}
                                  </div>
                                  <div className="public-sponsor-item__meta">
                                    {item.category ? (
                                      <span className="public-sponsor-badge">
                                        <i className="bi bi-tags" aria-hidden="true" />
                                        <span>{item.category}</span>
                                      </span>
                                    ) : null}
                                    {item.size ? (
                                      <span className="public-sponsor-badge">
                                        <i className="bi bi-rulers" aria-hidden="true" />
                                        <span>{item.size}</span>
                                      </span>
                                    ) : null}
                                    <span className="public-sponsor-badge">
                                      <i className="bi bi-flag" aria-hidden="true" />
                                      <span>{item.priority}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="public-sponsor-card__footer">
                      <div className="text-muted small">
                        Gifts are reserved immediately when you confirm your selection.
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={selectedWishlistItemIds.length === 0 || isCommittingGifts}
                        onClick={() => void handleCommitGifts()}
                      >
                        <i className="bi bi-bag-check me-2" aria-hidden="true" />
                        {isCommittingGifts ? 'Reserving...' : 'Reserve Selected Gifts'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 d-flex flex-wrap gap-2">
                <Link to={buildPublicCampaignSponsorPath(publicSlug)} className="btn btn-outline-secondary">
                  <i className="bi bi-arrow-left-circle me-2" aria-hidden="true" />
                  Back to Sponsor Page
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function mapGiftSearchItemToPublicSponsorItem(item: GiftSearchItem): PublicSponsorAvailableItem {
  return {
    wishlistItemId: item.wishlistItemId,
    description: item.description,
    category: item.category,
    itemType: item.itemType,
    size: item.size,
    qtyRequested: item.qtyRequested,
    priority: item.priority,
    recipient: item.recipient
      ? {
          id: item.recipient.id,
          displayLabel: item.recipient.publicLabel ?? item.recipient.displayLabel ?? 'Gift recipient',
          programRecipientId: null,
        }
      : null,
  };
}

function buildPublicFilterChips(result: GiftSearchResult): string[] {
  const filters = result.parsedFilters;
  const chips: string[] = [];
  if (filters.age_min !== null || filters.age_max !== null) {
    chips.push(`Age ${filters.age_min ?? 'any'}-${filters.age_max ?? 'up'}`);
  }
  if (filters.gender) {
    chips.push(filters.gender === 'F' ? 'Girls' : filters.gender === 'M' ? 'Boys' : 'Any gender');
  }
  filters.categories.forEach((category) => chips.push(category.replace('_', ' ')));
  filters.sizes.forEach((size) => chips.push(`Size ${size}`));
  return chips;
}
