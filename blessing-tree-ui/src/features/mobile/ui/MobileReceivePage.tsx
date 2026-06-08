import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildMobileScanPath } from '@/app/routes';
import { lookupCampaignReceiveGifts, updateCampaignGiftOperation } from '@/features/gifts/api/giftSearchApi';
import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { compareOptionalProgramIds } from '@/shared/lib/naturalSort';

const RECEIVED_OR_LATER_STATUSES = new Set([
  'RECEIVED',
  'WRAPPED',
  'TAGGED',
  'READY_FOR_DISTRIBUTION',
  'DISTRIBUTED',
  'PICKED_UP',
]);

type ReceiveRouteState = {
  recipientId?: string;
  autoLookup?: boolean;
};

type RecentReceiveAction = {
  giftId: string;
  description: string;
  action: 'received' | 'undone';
  status: string;
  occurredAt: Date;
};

export function MobileReceivePage() {
  const location = useLocation();
  const { selectedCampaign, selectedCampaignId } = useCampaigns();
  const [recipientIdDraft, setRecipientIdDraft] = useState('');
  const [lookedUpRecipientId, setLookedUpRecipientId] = useState('');
  const [items, setItems] = useState<GiftSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busyItemIds, setBusyItemIds] = useState<string[]>([]);
  const [recentActions, setRecentActions] = useState<RecentReceiveAction[]>([]);
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [receiveNote, setReceiveNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consumedScanValueRef = useRef<string | null>(null);
  const busyItemIdsRef = useRef<Set<string>>(new Set());

  const recipient = items[0]?.recipient ?? null;
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.description.localeCompare(right.description)),
    [items]
  );
  const groupedItems = useMemo(() => groupItemsByRecipient(sortedItems), [sortedItems]);

  const lookupRecipient = useCallback(async (nextRecipientId: string) => {
    if (!selectedCampaignId || !nextRecipientId) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setMessage(null);
    setItems([]);
    setActiveNoteItemId(null);
    setReceiveNote('');
    setRecentActions([]);
    setLookedUpRecipientId(nextRecipientId);

    try {
      const result = await lookupCampaignReceiveGifts(selectedCampaignId, nextRecipientId);
      if (result.items.length === 0) {
        setError(`No wishlist found for ${nextRecipientId}.`);
        return;
      }

      setItems(result.items);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to find recipient wishlist.');
    } finally {
      setIsSearching(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    const state = location.state as ReceiveRouteState | null;
    const scannedRecipientId = state?.recipientId?.trim();
    if (!state?.autoLookup || !scannedRecipientId || consumedScanValueRef.current === scannedRecipientId) {
      return;
    }
    consumedScanValueRef.current = scannedRecipientId;
    setRecipientIdDraft(scannedRecipientId);
    void lookupRecipient(scannedRecipientId);
  }, [location.state, lookupRecipient]);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await lookupRecipient(recipientIdDraft.trim());
  }

  async function handleReceive(item: GiftSearchItem) {
    if (!selectedCampaignId || isReceivedOrLater(item.status) || busyItemIdsRef.current.has(item.wishlistItemId)) {
      return;
    }

    busyItemIdsRef.current.add(item.wishlistItemId);
    setBusyItemIds((current) => addBusyGift(current, item.wishlistItemId));
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
      setRecentActions((current) =>
        addRecentAction(current, {
          giftId: updatedGift.wishlistItemId,
          description: updatedGift.description,
          action: 'received',
          status: updatedGift.status,
          occurredAt: new Date(),
        })
      );
      setActiveNoteItemId(null);
      setReceiveNote('');
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'Unable to receive gift.');
    } finally {
      busyItemIdsRef.current.delete(item.wishlistItemId);
      setBusyItemIds((current) => removeBusyGift(current, item.wishlistItemId));
    }
  }

  async function handleUnreceive(item: GiftSearchItem) {
    if (!selectedCampaignId || item.status !== 'RECEIVED' || busyItemIdsRef.current.has(item.wishlistItemId)) {
      return;
    }

    busyItemIdsRef.current.add(item.wishlistItemId);
    setBusyItemIds((current) => addBusyGift(current, item.wishlistItemId));
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
      setRecentActions((current) =>
        addRecentAction(current, {
          giftId: updatedGift.wishlistItemId,
          description: updatedGift.description,
          action: 'undone',
          status: updatedGift.status,
          occurredAt: new Date(),
        })
      );
    } catch (unreceiveError) {
      setError(unreceiveError instanceof Error ? unreceiveError.message : 'Unable to undo receive.');
    } finally {
      busyItemIdsRef.current.delete(item.wishlistItemId);
      setBusyItemIds((current) => removeBusyGift(current, item.wishlistItemId));
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
        <Link to={buildMobileScanPath()} className="mobile-secondary-action mobile-secondary-action--full">
          <i className="bi bi-qr-code-scan" aria-hidden="true" />
          Scan QR or ID
        </Link>
        <p className="mobile-search-card__hint">
          {selectedCampaign?.name ?? 'Selected campaign'} only. Use Scan for sponsor QR codes or typed recipient IDs.
        </p>
      </form>

      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}
      {message ? <div className="mobile-alert mobile-alert--success">{message}</div> : null}

      {recentActions.length > 0 ? (
        <section className="mobile-recent-actions" aria-label="Recently received gifts">
          <div className="mobile-recent-actions__header">
            <i className="bi bi-clock-history" aria-hidden="true" />
            <h2>Recent actions</h2>
          </div>
          <ul>
            {recentActions.map((action) => (
              <li key={`${action.giftId}-${action.action}-${action.occurredAt.getTime()}`}>
                <span>{action.description}</span>
                <strong>{action.action === 'received' ? 'Received' : `Undo to ${toStatusLabel(action.status)}`}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recipient ? (
        <section className="mobile-recipient-card" aria-label="Recipient summary">
          <div>
            <span className="mobile-recipient-card__label">{groupedItems.length > 1 ? 'Family' : 'Recipient'}</span>
            <h2>
              {groupedItems.length > 1
                ? recipient.groupLabel ?? lookedUpRecipientId
                : recipient.displayLabel ?? recipient.programRecipientId ?? lookedUpRecipientId}
            </h2>
          </div>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{groupedItems.length > 1 ? lookedUpRecipientId : recipient.programRecipientId ?? lookedUpRecipientId}</dd>
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

      {groupedItems.length > 0 ? (
        <section className="mobile-gift-list" aria-label="Wishlist items">
          {groupedItems.map((group) => (
            <div key={group.key} className="mobile-recipient-gift-group">
              {groupedItems.length > 1 ? (
                <header className="mobile-recipient-gift-group__header">
                  <span>{group.recipient?.programRecipientId ?? 'No recipient ID'}</span>
                  <h3>{group.recipient?.displayLabel ?? 'Recipient'}</h3>
                  <p>{formatAgeGender(group.recipient?.age ?? null, group.recipient?.ageUnit ?? null, group.recipient?.gender ?? null)}</p>
                </header>
              ) : null}
              {group.items.map((item) => {
                const isReceived = isReceivedOrLater(item.status);
                const isBusy = isGiftBusy(busyItemIds, item.wishlistItemId);
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
                      disabled={isBusy}
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
                      disabled={isBusy}
                      onClick={() => void handleReceive(item)}
                    >
                      {isBusy ? 'Receiving...' : 'Receive'}
                    </button>
                  </div>
                ) : item.status === 'RECEIVED' ? (
                  <div className="mobile-gift-card__actions">
                    <div className="mobile-gift-card__received">Received successfully.</div>
                    <button
                      type="button"
                      className="mobile-secondary-action mobile-secondary-action--danger"
                      disabled={isBusy}
                      onClick={() => void handleUnreceive(item)}
                    >
                      {isBusy ? 'Undoing...' : 'Undo'}
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
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function isReceivedOrLater(status: string): boolean {
  return RECEIVED_OR_LATER_STATUSES.has(status);
}

function groupItemsByRecipient(items: GiftSearchItem[]): Array<{
  key: string;
  recipient: GiftSearchItem['recipient'];
  items: GiftSearchItem[];
}> {
  const groups = new Map<string, { key: string; recipient: GiftSearchItem['recipient']; items: GiftSearchItem[] }>();
  for (const item of items) {
    const key = item.recipient?.id ?? 'unknown-recipient';
    const existingGroup = groups.get(key);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.set(key, { key, recipient: item.recipient, items: [item] });
    }
  }
  return [...groups.values()].sort((left, right) => {
    const idComparison = compareOptionalProgramIds(left.recipient?.programRecipientId, right.recipient?.programRecipientId);
    if (idComparison !== 0) {
      return idComparison;
    }
    return String(left.recipient?.displayLabel ?? '').localeCompare(String(right.recipient?.displayLabel ?? ''));
  });
}

function isGiftBusy(busyIds: string[], giftId: string): boolean {
  return busyIds.includes(giftId);
}

function addBusyGift(busyIds: string[], giftId: string): string[] {
  return busyIds.includes(giftId) ? busyIds : [...busyIds, giftId];
}

function removeBusyGift(busyIds: string[], giftId: string): string[] {
  return busyIds.filter((id) => id !== giftId);
}

function addRecentAction(actions: RecentReceiveAction[], action: RecentReceiveAction): RecentReceiveAction[] {
  return [action, ...actions.filter((item) => item.giftId !== action.giftId)].slice(0, 5);
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
