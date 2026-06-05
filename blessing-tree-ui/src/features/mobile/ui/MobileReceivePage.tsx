import { useMemo, useState, type FormEvent } from 'react';
import { searchCampaignGifts, updateCampaignGiftOperation } from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';

const RECEIVED_OR_LATER_STATUSES = new Set([
  'RECEIVED',
  'WRAPPED',
  'TAGGED',
  'READY_FOR_DISTRIBUTION',
  'DISTRIBUTED',
  'PICKED_UP',
]);

export function MobileReceivePage() {
  const { selectedCampaign, selectedCampaignId } = useCampaigns();
  const [recipientIdDraft, setRecipientIdDraft] = useState('');
  const [lookedUpRecipientId, setLookedUpRecipientId] = useState('');
  const [items, setItems] = useState<GiftSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null);
  const [unreceivingItemId, setUnreceivingItemId] = useState<string | null>(null);
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [receiveNote, setReceiveNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipient = items[0]?.recipient ?? null;
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.description.localeCompare(right.description)),
    [items]
  );

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRecipientId = recipientIdDraft.trim();
    if (!selectedCampaignId || !nextRecipientId) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setMessage(null);
    setItems([]);
    setActiveNoteItemId(null);
    setReceiveNote('');
    setLookedUpRecipientId(nextRecipientId);

    try {
      const result = await searchCampaignGifts(selectedCampaignId, nextRecipientId);
      const normalizedLookup = normalizeRecipientId(nextRecipientId);
      const exactMatches = result.items.filter(
        (item) => normalizeRecipientId(item.recipient?.programRecipientId) === normalizedLookup
      );

      if (exactMatches.length === 0) {
        setError(`No wishlist found for ${nextRecipientId}.`);
        return;
      }

      const firstRecipientId = exactMatches[0]?.recipient?.id;
      const recipientItems = exactMatches.filter((item) => item.recipient?.id === firstRecipientId);
      setItems(recipientItems);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to find recipient wishlist.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleReceive(item: GiftSearchItem) {
    if (!selectedCampaignId || isReceivedOrLater(item.status)) {
      return;
    }

    setReceivingItemId(item.wishlistItemId);
    setError(null);
    setMessage(null);

    try {
      const updatedGift = await updateCampaignGiftOperation(
        selectedCampaignId,
        item.wishlistItemId,
        'receive',
        activeNoteItemId === item.wishlistItemId ? receiveNote : undefined
      );
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.wishlistItemId === item.wishlistItemId ? updatedGift : currentItem
        )
      );
      setMessage(`${updatedGift.description} marked received.`);
      setActiveNoteItemId(null);
      setReceiveNote('');
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'Unable to receive gift.');
    } finally {
      setReceivingItemId(null);
    }
  }

  async function handleUnreceive(item: GiftSearchItem) {
    if (!selectedCampaignId || item.status !== 'RECEIVED') {
      return;
    }

    setUnreceivingItemId(item.wishlistItemId);
    setError(null);
    setMessage(null);

    try {
      const updatedGift = await updateCampaignGiftOperation(
        selectedCampaignId,
        item.wishlistItemId,
        'unreceive',
        'Corrected accidental mobile receive.'
      );
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.wishlistItemId === item.wishlistItemId ? updatedGift : currentItem
        )
      );
      setMessage(`${updatedGift.description} moved back to ${toStatusLabel(updatedGift.status)}.`);
    } catch (unreceiveError) {
      setError(unreceiveError instanceof Error ? unreceiveError.message : 'Unable to undo receive.');
    } finally {
      setUnreceivingItemId(null);
    }
  }

  return (
    <section className="mobile-page mobile-receive-page">
      <div className="mobile-page__hero">
        <span className="mobile-page__eyebrow">Receive Gifts</span>
        <h1>Receive by recipient ID</h1>
        <p>Enter the ID on the printed list or label, then tap each gift as it arrives.</p>
      </div>

      <form className="mobile-search-card" onSubmit={handleLookup}>
        <label className="mobile-search-card__label" htmlFor="mobile-recipient-id">
          Recipient ID
        </label>
        <div className="mobile-search-card__input-wrap">
          <i className="bi bi-upc-scan" aria-hidden="true" />
          <input
            id="mobile-recipient-id"
            className="mobile-search-card__input"
            type="search"
            value={recipientIdDraft}
            onChange={(event) => setRecipientIdDraft(event.target.value)}
            placeholder="BT-001"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="mobile-primary-action"
          disabled={!selectedCampaignId || isSearching || !recipientIdDraft.trim()}
        >
          {isSearching ? 'Finding...' : 'Find Wishlist'}
        </button>
        <p className="mobile-search-card__hint">
          {selectedCampaign?.name ?? 'Selected campaign'} only. Scanner support can plug into this same field later.
        </p>
      </form>

      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}
      {message ? <div className="mobile-alert mobile-alert--success">{message}</div> : null}

      {recipient ? (
        <section className="mobile-recipient-card" aria-label="Recipient summary">
          <div>
            <span className="mobile-recipient-card__label">Recipient</span>
            <h2>{recipient.displayLabel ?? recipient.programRecipientId ?? lookedUpRecipientId}</h2>
          </div>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{recipient.programRecipientId ?? lookedUpRecipientId}</dd>
            </div>
            <div>
              <dt>Age / Gender</dt>
              <dd>{formatAgeGender(recipient.age, recipient.ageUnit, recipient.gender)}</dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>{recipient.groupLabel ?? 'No group listed'}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {sortedItems.length > 0 ? (
        <section className="mobile-gift-list" aria-label="Wishlist items">
          {sortedItems.map((item) => {
            const isReceived = isReceivedOrLater(item.status);
            const isReceiving = receivingItemId === item.wishlistItemId;
            const isUnreceiving = unreceivingItemId === item.wishlistItemId;
            const noteOpen = activeNoteItemId === item.wishlistItemId;
            return (
              <article key={item.wishlistItemId} className="mobile-gift-card">
                <div className="mobile-gift-card__main">
                  <div
                    className={`mobile-gift-card__check ${isReceived ? 'mobile-gift-card__check--received' : ''}`}
                    aria-hidden="true"
                  >
                    <i className={`bi ${isReceived ? 'bi-check-lg' : 'bi-gift'}`} aria-hidden="true" />
                  </div>
                  <div className="mobile-gift-card__content">
                    <h3>{item.description}</h3>
                    <p>
                      {[item.category ?? item.itemType, item.size].filter(Boolean).join(' · ') || 'Gift item'}
                    </p>
                    <div className="mobile-gift-card__meta">
                      <span>{toStatusLabel(item.status)}</span>
                      <span>{item.sponsor?.displayName ?? 'No sponsor'}</span>
                    </div>
                  </div>
                </div>

                {!isReceived ? (
                  <div className="mobile-gift-card__actions">
                    <button
                      type="button"
                      className="mobile-secondary-action"
                      onClick={() => {
                        setActiveNoteItemId(noteOpen ? null : item.wishlistItemId);
                        setReceiveNote('');
                      }}
                    >
                      {noteOpen ? 'Hide note' : 'Received different item?'}
                    </button>
                    <button
                      type="button"
                      className="mobile-primary-action mobile-primary-action--inline"
                      disabled={isReceiving}
                      onClick={() => void handleReceive(item)}
                    >
                      {isReceiving ? 'Receiving...' : 'Receive'}
                    </button>
                  </div>
                ) : item.status === 'RECEIVED' ? (
                  <div className="mobile-gift-card__actions">
                    <div className="mobile-gift-card__received">Received successfully.</div>
                    <button
                      type="button"
                      className="mobile-secondary-action mobile-secondary-action--danger"
                      disabled={isUnreceiving}
                      onClick={() => void handleUnreceive(item)}
                    >
                      {isUnreceiving ? 'Undoing...' : 'Undo'}
                    </button>
                  </div>
                ) : (
                  <div className="mobile-gift-card__received">Received. Further changes require the full site.</div>
                )}

                {noteOpen ? (
                  <div className="mobile-note-panel">
                    <label htmlFor={`receive-note-${item.wishlistItemId}`}>
                      Note only. This will not change the wishlist description.
                    </label>
                    <textarea
                      id={`receive-note-${item.wishlistItemId}`}
                      value={receiveNote}
                      onChange={(event) => setReceiveNote(event.target.value)}
                      placeholder="Example: Sponsor brought Superman instead of Batman."
                      rows={3}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </section>
  );
}

function normalizeRecipientId(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function isReceivedOrLater(status: string): boolean {
  return RECEIVED_OR_LATER_STATUSES.has(status);
}

function toStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatAgeGender(age: number | null, ageUnit: string | null, gender: string | null): string {
  const ageText = age === null ? 'Age not listed' : `${age}${ageUnit === 'MONTHS' ? ' mos' : ''}`;
  const genderText = gender ? gender.toUpperCase() : 'Gender not listed';
  return `${ageText} / ${genderText}`;
}
