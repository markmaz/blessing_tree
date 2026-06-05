import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  commitCampaignGift,
  releaseCampaignGift,
  searchCampaignGifts,
  updateCampaignGiftOperation,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';
import { getCampaignSponsorWorkspace } from '@/features/campaigns/api/campaignSponsorWorkspaceApi';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { getCampaignPeopleWorkspace } from '@/features/campaigns/api/campaignPeopleWorkspaceApi';
import type { CampaignPeopleGroup } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';

const RECEIVED_OR_LATER_STATUSES = new Set([
  'RECEIVED',
  'WRAPPED',
  'TAGGED',
  'READY_FOR_DISTRIBUTION',
  'DISTRIBUTED',
  'PICKED_UP',
]);

export function MobileGiftsPage() {
  const { selectedCampaignId } = useCampaigns();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiftSearchItem[]>([]);
  const [sponsors, setSponsors] = useState<CampaignSponsor[]>([]);
  const [sponsorQuery, setSponsorQuery] = useState('');
  const [selectedSponsor, setSelectedSponsor] = useState<CampaignSponsor | null>(null);
  const [commitGift, setCommitGift] = useState<GiftSearchItem | null>(null);
  const [commitNotes, setCommitNotes] = useState('');
  const [releaseGift, setReleaseGift] = useState<GiftSearchItem | null>(null);
  const [busyGiftId, setBusyGiftId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSponsors, setIsLoadingSponsors] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sponsorMatches = useMemo(() => {
    const normalized = normalizeSearch(sponsorQuery);
    if (!normalized) return [];
    return sponsors
      .filter((sponsor) => searchableSponsorText(sponsor).includes(normalized))
      .slice(0, 8);
  }, [sponsorQuery, sponsors]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId || !query.trim()) return;
    setIsSearching(true);
    setError(null);
    setMessage(null);
    try {
      const result = await searchCampaignGifts(selectedCampaignId, query);
      setItems(result.items);
      if (result.items.length === 0) {
        setMessage('No gifts matched that search.');
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Unable to search gifts.');
    } finally {
      setIsSearching(false);
    }
  }

  async function openCommit(item: GiftSearchItem) {
    setCommitGift(item);
    setSelectedSponsor(null);
    setSponsorQuery('');
    setCommitNotes('');
    setError(null);
    if (!selectedCampaignId || sponsors.length > 0) return;
    setIsLoadingSponsors(true);
    try {
      const workspace = await getCampaignSponsorWorkspace(selectedCampaignId);
      setSponsors(workspace.sponsors);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sponsors.');
    } finally {
      setIsLoadingSponsors(false);
    }
  }

  async function handleCommit() {
    if (!selectedCampaignId || !commitGift || !selectedSponsor) return;
    setBusyGiftId(commitGift.wishlistItemId);
    setError(null);
    try {
      const updated = await commitCampaignGift(
        selectedCampaignId,
        commitGift.wishlistItemId,
        selectedSponsor.id,
        commitNotes
      );
      replaceGift(updated);
      setMessage(`${updated.description} committed to ${selectedSponsor.displayName}.`);
      setCommitGift(null);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Unable to commit gift.');
    } finally {
      setBusyGiftId(null);
    }
  }

  async function handleRelease() {
    if (!selectedCampaignId || !releaseGift) return;
    setBusyGiftId(releaseGift.wishlistItemId);
    setError(null);
    try {
      const updated = await releaseCampaignGift(selectedCampaignId, releaseGift.wishlistItemId);
      replaceGift(updated);
      setMessage(`${updated.description} is available again.`);
      setReleaseGift(null);
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : 'Unable to release gift.');
    } finally {
      setBusyGiftId(null);
    }
  }

  async function handleOperation(item: GiftSearchItem, action: 'receive' | 'unreceive') {
    if (!selectedCampaignId) return;
    setBusyGiftId(item.wishlistItemId);
    setError(null);
    try {
      const updated = await updateCampaignGiftOperation(selectedCampaignId, item.wishlistItemId, action);
      replaceGift(updated);
      setMessage(`${updated.description} moved to ${toStatusLabel(updated.status)}.`);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Unable to update gift.');
    } finally {
      setBusyGiftId(null);
    }
  }

  function replaceGift(updated: GiftSearchItem) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.wishlistItemId === updated.wishlistItemId ? updated : item))
    );
  }

  return (
    <section className="mobile-page">
      <MobileSearchHeader
        eyebrow="Gift Search"
        title="Find gifts quickly"
        description="Search by recipient ID, recipient name, gift text, sponsor, family, or organization."
      />

      <MobileSearchForm
        label="Gift search"
        icon="bi-search-heart"
        value={query}
        placeholder="BT-001, Batman, Rachel Morales..."
        isSearching={isSearching}
        onChange={setQuery}
        onSubmit={handleSearch}
      />

      <MobileFeedback error={error} message={message} />

      <section className="mobile-result-list" aria-label="Gift results">
        {items.map((item) => {
          const isBusy = busyGiftId === item.wishlistItemId;
          const canReceive = !RECEIVED_OR_LATER_STATUSES.has(item.status) && item.status !== 'CANCELLED';
          const canUndo = item.status === 'RECEIVED';
          return (
            <article key={item.wishlistItemId} className="mobile-lookup-card">
              <div className="mobile-lookup-card__header">
                <div>
                  <span className="mobile-lookup-card__eyebrow">{item.recipient?.programRecipientId ?? 'No ID'}</span>
                  <h2>{item.description}</h2>
                </div>
                <span className="mobile-status-chip">{toStatusLabel(item.status)}</span>
              </div>
              <p>{[item.category ?? item.itemType, item.size].filter(Boolean).join(' · ') || 'Gift item'}</p>
              <dl className="mobile-detail-grid">
                <MobileDetail label="Recipient" value={formatRecipient(item)} />
                <MobileDetail label="Group" value={item.recipient?.groupLabel ?? 'No group'} />
                <MobileDetail label="Sponsor" value={item.sponsor?.displayName ?? 'No sponsor'} />
                <MobileDetail label="Age / Gender" value={formatAgeGender(item.recipient?.age ?? null, item.recipient?.ageUnit ?? null, item.recipient?.gender ?? null)} />
              </dl>
              <details className="mobile-detail-disclosure">
                <summary>Details</summary>
                <div className="mobile-detail-disclosure__body">
                  {item.recipientNote ? <p><strong>Recipient note:</strong> {item.recipientNote}</p> : null}
                  {item.notes ? <p><strong>Gift note:</strong> {item.notes}</p> : null}
                  {item.sponsor ? (
                    <p><strong>Sponsor contact:</strong> {[item.sponsor.email, item.sponsor.phone].filter(Boolean).join(' · ') || 'No contact listed'}</p>
                  ) : null}
                </div>
              </details>
              <div className="mobile-card-actions">
                {!item.sponsor && !RECEIVED_OR_LATER_STATUSES.has(item.status) ? (
                  <button type="button" className="mobile-secondary-action" onClick={() => void openCommit(item)}>
                    Commit
                  </button>
                ) : null}
                {item.sponsor && !RECEIVED_OR_LATER_STATUSES.has(item.status) ? (
                  <button type="button" className="mobile-secondary-action mobile-secondary-action--danger" onClick={() => setReleaseGift(item)}>
                    Release
                  </button>
                ) : null}
                {canReceive ? (
                  <button type="button" className="mobile-primary-action mobile-primary-action--inline" disabled={isBusy} onClick={() => void handleOperation(item, 'receive')}>
                    {isBusy ? 'Receiving...' : 'Receive'}
                  </button>
                ) : null}
                {canUndo ? (
                  <button type="button" className="mobile-secondary-action mobile-secondary-action--danger" disabled={isBusy} onClick={() => void handleOperation(item, 'unreceive')}>
                    {isBusy ? 'Undoing...' : 'Undo'}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {commitGift ? (
        <div className="mobile-modal" role="dialog" aria-modal="true" aria-label="Commit gift">
          <div className="mobile-modal__panel">
            <h2>Commit gift</h2>
            <p>{commitGift.description}</p>
            <label className="mobile-search-card__label" htmlFor="mobile-sponsor-search">Sponsor search</label>
            <div className="mobile-search-card__input-wrap">
              <i className="bi bi-person-heart" aria-hidden="true" />
              <input
                id="mobile-sponsor-search"
                className="mobile-search-card__input"
                type="search"
                value={sponsorQuery}
                onChange={(event) => setSponsorQuery(event.target.value)}
                placeholder="Search sponsor name, phone, email"
              />
            </div>
            {isLoadingSponsors ? <p className="mobile-muted">Loading sponsors...</p> : null}
            {selectedSponsor ? (
              <div className="mobile-selected-pill">
                <span>{selectedSponsor.displayName}</span>
                <button type="button" onClick={() => setSelectedSponsor(null)} aria-label="Clear selected sponsor">
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {sponsorMatches.length > 0 && !selectedSponsor ? (
              <div className="mobile-choice-list">
                {sponsorMatches.map((sponsor) => (
                  <button key={sponsor.id} type="button" onClick={() => setSelectedSponsor(sponsor)}>
                    <strong>{sponsor.displayName}</strong>
                    <span>{[sponsor.email, sponsor.phone].filter(Boolean).join(' · ') || 'No contact listed'}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <label className="mobile-search-card__label" htmlFor="mobile-commit-notes">Notes</label>
            <textarea
              id="mobile-commit-notes"
              className="mobile-modal__textarea"
              value={commitNotes}
              onChange={(event) => setCommitNotes(event.target.value)}
              rows={3}
            />
            <div className="mobile-modal__actions">
              <button type="button" className="mobile-secondary-action" onClick={() => setCommitGift(null)}>
                Cancel
              </button>
              <button type="button" className="mobile-primary-action mobile-primary-action--inline" disabled={!selectedSponsor || busyGiftId === commitGift.wishlistItemId} onClick={() => void handleCommit()}>
                Commit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {releaseGift ? (
        <div className="mobile-modal" role="dialog" aria-modal="true" aria-label="Release gift">
          <div className="mobile-modal__panel">
            <h2>Release sponsor?</h2>
            <p>
              Release {releaseGift.sponsor?.displayName ?? 'this sponsor'} from {releaseGift.description} and make the gift available again.
            </p>
            <div className="mobile-modal__actions">
              <button type="button" className="mobile-secondary-action" onClick={() => setReleaseGift(null)}>
                Cancel
              </button>
              <button type="button" className="mobile-secondary-action mobile-secondary-action--danger" disabled={busyGiftId === releaseGift.wishlistItemId} onClick={() => void handleRelease()}>
                Release
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MobileSponsorsPage() {
  const { selectedCampaign, selectedCampaignId } = useCampaigns();
  const [query, setQuery] = useState('');
  const [sponsors, setSponsors] = useState<CampaignSponsor[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return sponsors.filter((sponsor) => searchableSponsorText(sponsor).includes(normalized)).slice(0, 25);
  }, [query, sponsors]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId || !query.trim()) return;
    setError(null);
    if (!hasLoaded) {
      setIsLoading(true);
      try {
        const workspace = await getCampaignSponsorWorkspace(selectedCampaignId);
        setSponsors(workspace.sponsors);
        setHasLoaded(true);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load sponsors.');
      } finally {
        setIsLoading(false);
      }
    }
  }

  return (
    <section className="mobile-page">
      <MobileSearchHeader
        eyebrow="Sponsor Search"
        title="Look up sponsor commitments"
        description="Find a sponsor by name, phone, or email and view their committed gifts."
      />
      <MobileSearchForm
        label="Sponsor search"
        icon="bi-person-heart"
        value={query}
        placeholder="Name, phone, or email"
        isSearching={isLoading}
        onChange={setQuery}
        onSubmit={handleSearch}
      />
      <MobileFeedback error={error} message={hasLoaded && matches.length === 0 && query.trim() ? 'No sponsors matched that search.' : null} />
      <section className="mobile-result-list" aria-label="Sponsor results">
        {matches.map((sponsor) => (
          <article key={sponsor.id} className="mobile-lookup-card">
            <div className="mobile-lookup-card__header">
              <div>
                <span className="mobile-lookup-card__eyebrow">{sponsor.participation.dropOffStatus.replaceAll('_', ' ')}</span>
                <h2>{sponsor.displayName}</h2>
              </div>
              <span className="mobile-status-chip">{sponsor.sponsoredItemCount} gifts</span>
            </div>
            <p>{[sponsor.email, sponsor.phone].filter(Boolean).join(' · ') || 'No contact listed'}</p>
            <details className="mobile-detail-disclosure" open>
              <summary>Committed gifts</summary>
              <div className="mobile-mini-list">
                {sponsor.sponsoredItems.length > 0 ? sponsor.sponsoredItems.map((item) => (
                  <div key={item.id} className="mobile-mini-row">
                    <strong>{item.gift?.description ?? 'Gift'}</strong>
                    <span>{item.recipient?.programRecipientId ?? 'No ID'} · {item.recipient?.displayLabel ?? 'Recipient'} · {toStatusLabel(item.gift?.status ?? 'OPEN')}</span>
                  </div>
                )) : <p className="mobile-muted">No committed gifts.</p>}
              </div>
            </details>
          </article>
        ))}
      </section>
      <p className="mobile-search-card__hint">{selectedCampaign?.name ?? 'Selected campaign'} only.</p>
    </section>
  );
}

export function MobileGroupsPage() {
  const { selectedCampaign, selectedCampaignId } = useCampaigns();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<CampaignPeopleGroup[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return groups.filter((group) => searchableGroupText(group).includes(normalized)).slice(0, 25);
  }, [groups, query]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId || !query.trim()) return;
    setError(null);
    if (!hasLoaded) {
      setIsLoading(true);
      try {
        const workspace = await getCampaignPeopleWorkspace(selectedCampaignId);
        setGroups(workspace.groups);
        setHasLoaded(true);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load groups.');
      } finally {
        setIsLoading(false);
      }
    }
  }

  return (
    <section className="mobile-page">
      <MobileSearchHeader
        eyebrow="Group Search"
        title="Find households and organizations"
        description="Search by group name, contact, program abbreviation, or recipient ID."
      />
      <MobileSearchForm
        label="Group search"
        icon="bi-people"
        value={query}
        placeholder="Alvarez Family, OAK, BT-001..."
        isSearching={isLoading}
        onChange={setQuery}
        onSubmit={handleSearch}
      />
      <MobileFeedback error={error} message={hasLoaded && matches.length === 0 && query.trim() ? 'No groups matched that search.' : null} />
      <section className="mobile-result-list" aria-label="Group results">
        {matches.map((group) => (
          <article key={group.id} className="mobile-lookup-card">
            <div className="mobile-lookup-card__header">
              <div>
                <span className="mobile-lookup-card__eyebrow">{group.programAbbreviation ?? group.groupType}</span>
                <h2>{group.groupName}</h2>
              </div>
              <span className="mobile-status-chip">{group.recipientCount} people</span>
            </div>
            <p>{group.primaryContact ? `${group.primaryContact.displayName} · ${[group.primaryContact.email, group.primaryContact.phone].filter(Boolean).join(' · ')}` : 'No primary contact listed'}</p>
            <details className="mobile-detail-disclosure" open>
              <summary>Recipients and gifts</summary>
              <div className="mobile-mini-list">
                {group.recipients.map((recipient) => (
                  <div key={recipient.id} className="mobile-mini-row">
                    <strong>{recipient.programRecipientId ?? 'No ID'} · {recipient.displayLabel}</strong>
                    <span>{formatAgeGender(recipient.age, recipient.ageUnit ?? null, recipient.gender)}</span>
                    {recipient.wishlist?.items.map((gift) => (
                      <span key={gift.id}>{gift.description} · {toStatusLabel(gift.status)} · {gift.sponsor?.displayName ?? 'No sponsor'}</span>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
      </section>
      <p className="mobile-search-card__hint">{selectedCampaign?.name ?? 'Selected campaign'} only.</p>
    </section>
  );
}

function MobileSearchHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mobile-page__hero">
      <span className="mobile-page__eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function MobileSearchForm({
  label,
  icon,
  value,
  placeholder,
  isSearching,
  onChange,
  onSubmit,
}: {
  label: string;
  icon: string;
  value: string;
  placeholder: string;
  isSearching: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputId = `mobile-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <form className="mobile-search-card" onSubmit={onSubmit}>
      <label className="mobile-search-card__label" htmlFor={inputId}>{label}</label>
      <div className="mobile-search-card__input-wrap">
        <i className={`bi ${icon}`} aria-hidden="true" />
        <input
          id={inputId}
          className="mobile-search-card__input"
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <button type="submit" className="mobile-primary-action" disabled={isSearching || !value.trim()}>
        {isSearching ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}

function MobileFeedback({ error, message }: { error: string | null; message: string | null }) {
  return (
    <>
      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}
      {message ? <div className="mobile-alert mobile-alert--success">{message}</div> : null}
    </>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function normalizeSearch(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function searchableSponsorText(sponsor: CampaignSponsor): string {
  return normalizeSearch([
    sponsor.displayName,
    sponsor.organizationName,
    sponsor.email,
    sponsor.phone,
    sponsor.sponsoredItems.map((item) => [
      item.recipient?.programRecipientId,
      item.recipient?.displayLabel,
      item.gift?.description,
      item.gift?.status,
    ].filter(Boolean).join(' ')).join(' '),
  ].filter(Boolean).join(' '));
}

function searchableGroupText(group: CampaignPeopleGroup): string {
  return normalizeSearch([
    group.groupName,
    group.groupType,
    group.organizationType,
    group.programAbbreviation,
    group.primaryContact?.displayName,
    group.primaryContact?.email,
    group.primaryContact?.phone,
    group.recipients.map((recipient) => [
      recipient.programRecipientId,
      recipient.displayLabel,
      recipient.wishlist?.items.map((item) => [item.description, item.sponsor?.displayName, item.status].filter(Boolean).join(' ')).join(' '),
    ].filter(Boolean).join(' ')).join(' '),
  ].filter(Boolean).join(' '));
}

function formatRecipient(item: GiftSearchItem): string {
  return [item.recipient?.programRecipientId, item.recipient?.displayLabel].filter(Boolean).join(' · ') || 'Recipient';
}

function formatAgeGender(age: number | null, ageUnit: string | null, gender: string | null): string {
  const ageText = age === null ? 'Age not listed' : `${age}${ageUnit === 'MONTHS' ? ' mos' : ''}`;
  const genderText = gender ? gender.toUpperCase() : 'Gender not listed';
  return `${ageText} / ${genderText}`;
}

function toStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
