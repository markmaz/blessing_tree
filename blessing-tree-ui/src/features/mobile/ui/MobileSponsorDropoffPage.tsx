import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  getSponsorDropoffPayload,
  updateCampaignGiftOperation,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftOperationsItem, SponsorDropoffGift, SponsorDropoffPayload } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { ApiError } from '@/shared/api/client';

type RecentDropoffAction = {
  giftId: string;
  description: string;
  action: 'received' | 'undone';
  status: string;
  occurredAt: Date;
};

export function MobileSponsorDropoffPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { selectedCampaignId } = useCampaigns();
  const dropoffCampaignId = searchParams.get('campaignId') || selectedCampaignId;
  const [payload, setPayload] = useState<SponsorDropoffPayload | null>(null);
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [receiveNote, setReceiveNote] = useState('');
  const [busyGiftIds, setBusyGiftIds] = useState<string[]>([]);
  const [recentActions, setRecentActions] = useState<RecentDropoffAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyGiftIdsRef = useRef<Set<string>>(new Set());

  const loadDropoff = useCallback(async () => {
    if (!dropoffCampaignId || !token) {
      setPayload(null);
      setMessage(null);
      setIsLoading(false);
      setError('This QR code is missing its campaign context. Scan the latest sponsor email QR code or select the campaign before opening it.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      setPayload(await getSponsorDropoffPayload(dropoffCampaignId, token));
      setRecentActions([]);
    } catch (loadError) {
      setPayload(null);
      setError(toDropoffLoadErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [dropoffCampaignId, token]);

  useEffect(() => {
    void loadDropoff();
  }, [loadDropoff]);

  async function handleReceive(gift: SponsorDropoffGift) {
    if (!dropoffCampaignId || !gift.canReceive || busyGiftIdsRef.current.has(gift.wishlistItemId)) return;
    busyGiftIdsRef.current.add(gift.wishlistItemId);
    setBusyGiftIds((current) => addBusyGift(current, gift.wishlistItemId));
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCampaignGiftOperation(
        dropoffCampaignId,
        gift.wishlistItemId,
        'receive',
        activeNoteItemId === gift.wishlistItemId ? receiveNote : undefined
      );
      replaceGift(updated);
      setActiveNoteItemId(null);
      setReceiveNote('');
      setMessage(`${updated.description} marked received.`);
      setRecentActions((current) =>
        addRecentAction(current, {
          giftId: updated.wishlistItemId,
          description: updated.description,
          action: 'received',
          status: updated.status,
          occurredAt: new Date(),
        })
      );
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'Unable to receive gift.');
    } finally {
      busyGiftIdsRef.current.delete(gift.wishlistItemId);
      setBusyGiftIds((current) => removeBusyGift(current, gift.wishlistItemId));
    }
  }

  async function handleUnreceive(gift: SponsorDropoffGift) {
    if (!dropoffCampaignId || !gift.canUnreceive || busyGiftIdsRef.current.has(gift.wishlistItemId)) return;
    busyGiftIdsRef.current.add(gift.wishlistItemId);
    setBusyGiftIds((current) => addBusyGift(current, gift.wishlistItemId));
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCampaignGiftOperation(
        dropoffCampaignId,
        gift.wishlistItemId,
        'unreceive',
        'Corrected accidental sponsor drop-off receive.'
      );
      replaceGift(updated);
      setMessage(`${updated.description} moved back to ${toStatusLabel(updated.status)}.`);
      setRecentActions((current) =>
        addRecentAction(current, {
          giftId: updated.wishlistItemId,
          description: updated.description,
          action: 'undone',
          status: updated.status,
          occurredAt: new Date(),
        })
      );
    } catch (unreceiveError) {
      setError(unreceiveError instanceof Error ? unreceiveError.message : 'Unable to undo receive.');
    } finally {
      busyGiftIdsRef.current.delete(gift.wishlistItemId);
      setBusyGiftIds((current) => removeBusyGift(current, gift.wishlistItemId));
    }
  }

  function replaceGift(updated: GiftOperationsItem) {
    setPayload((current) => {
      if (!current) return current;
      return {
        ...current,
        recipients: current.recipients.map((recipient) => ({
          ...recipient,
          gifts: recipient.gifts.map((gift) =>
            gift.wishlistItemId === updated.wishlistItemId
              ? {
                  ...gift,
                  status: updated.status,
                  receivedAt: updated.receivedAt,
                  canReceive: !isReceivedOrLater(updated.status) && updated.status !== 'CANCELLED',
                  canUnreceive: updated.status === 'RECEIVED',
                }
              : gift
          ),
        })),
      };
    });
  }

  return (
    <section className="mobile-page mobile-dropoff-page">
      <div className="mobile-page__hero">
        <span className="mobile-page__eyebrow">Sponsor Drop-Off</span>
        <h1>{payload?.sponsor.displayName ?? 'Sponsor gifts'}</h1>
        <p>
          {payload
            ? [payload.sponsor.phone, payload.sponsor.email].filter(Boolean).join(' · ') || 'No sponsor contact listed'
            : 'Open the sponsor gift list from the QR code.'}
        </p>
      </div>

      {!dropoffCampaignId ? (
        <div className="mobile-alert mobile-alert--danger">Select a campaign before receiving gifts.</div>
      ) : null}
      {isLoading ? <div className="mobile-alert mobile-scan-notice">Loading sponsor drop-off...</div> : null}
      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}
      {message ? <div className="mobile-alert mobile-alert--success">{message}</div> : null}

      {recentActions.length > 0 ? (
        <section className="mobile-recent-actions" aria-label="Recently received drop-off gifts">
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

      {payload ? (
        <>
          <section className="mobile-recipient-card" aria-label="Sponsor drop-off summary">
            <div>
              <span className="mobile-recipient-card__label">Drop-Off</span>
              <h2>{toStatusLabel(payload.sponsorship.dropOffStatus)}</h2>
            </div>
            <dl>
              <div>
                <dt>Campaign</dt>
                <dd>{payload.campaign.name}</dd>
              </div>
              <div>
                <dt>Recipients</dt>
                <dd>{payload.recipients.length}</dd>
              </div>
              <div>
                <dt>Gifts</dt>
                <dd>{payload.recipients.reduce((count, recipient) => count + recipient.gifts.length, 0)}</dd>
              </div>
            </dl>
          </section>

          {payload.recipients.length === 0 ? (
            <div className="mobile-alert mobile-scan-notice">No committed gifts are currently tied to this sponsor.</div>
          ) : null}

          {payload.recipients.map((recipient) => (
            <section key={recipient.id ?? recipient.displayLabel} className="mobile-recipient-card">
              <div>
                <span className="mobile-recipient-card__label">{recipient.programRecipientId ?? 'No ID'}</span>
                <h2>{recipient.displayLabel}</h2>
              </div>
              <dl>
                <div>
                  <dt>Age / Gender</dt>
                  <dd>{formatAgeGender(recipient.age, recipient.ageUnit, recipient.gender)}</dd>
                </div>
                <div>
                  <dt>Group</dt>
                  <dd>{recipient.groupLabel ?? 'No group listed'}</dd>
                </div>
              </dl>
              <div className="mobile-gift-list">
                {recipient.gifts.map((gift) => {
                  const isBusy = isGiftBusy(busyGiftIds, gift.wishlistItemId);
                  const noteOpen = activeNoteItemId === gift.wishlistItemId;
                  return (
                    <article key={gift.wishlistItemId} className="mobile-gift-card">
                      <div className="mobile-gift-card__main">
                        <div
                          className={`mobile-gift-card__check ${isReceivedOrLater(gift.status) ? 'mobile-gift-card__check--received' : ''}`}
                          aria-hidden="true"
                        >
                          <i className={`bi ${isReceivedOrLater(gift.status) ? 'bi-check-lg' : 'bi-gift'}`} aria-hidden="true" />
                        </div>
                        <div className="mobile-gift-card__content">
                          <h3>{gift.description}</h3>
                          <p>{[gift.category ?? gift.itemType, gift.size].filter(Boolean).join(' · ') || 'Gift item'}</p>
                          <div className="mobile-gift-card__meta">
                            <span>{toStatusLabel(gift.status)}</span>
                          </div>
                        </div>
                      </div>

                      {gift.canReceive ? (
                        <div className="mobile-gift-card__actions">
                          <button
                            type="button"
                            className="mobile-secondary-action"
                            disabled={isBusy}
                            onClick={() => {
                              setActiveNoteItemId(noteOpen ? null : gift.wishlistItemId);
                              setReceiveNote('');
                            }}
                          >
                            {noteOpen ? 'Hide note' : 'Received different item?'}
                          </button>
                          <button
                            type="button"
                            className="mobile-primary-action mobile-primary-action--inline"
                            disabled={isBusy}
                            onClick={() => void handleReceive(gift)}
                          >
                            {isBusy ? 'Receiving...' : 'Receive'}
                          </button>
                        </div>
                      ) : gift.canUnreceive ? (
                        <div className="mobile-gift-card__actions">
                          <div className="mobile-gift-card__received">Received successfully.</div>
                          <button
                            type="button"
                            className="mobile-secondary-action mobile-secondary-action--danger"
                            disabled={isBusy}
                            onClick={() => void handleUnreceive(gift)}
                          >
                            {isBusy ? 'Undoing...' : 'Undo'}
                          </button>
                        </div>
                      ) : (
                        <div className="mobile-gift-card__received">Further changes require the full site.</div>
                      )}

                      {noteOpen ? (
                        <div className="mobile-note-panel">
                          <label htmlFor={`dropoff-note-${gift.wishlistItemId}`}>
                            Note only. This will not change the wishlist description.
                          </label>
                          <textarea
                            id={`dropoff-note-${gift.wishlistItemId}`}
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
            </section>
          ))}
        </>
      ) : null}
    </section>
  );
}

function isReceivedOrLater(status: string): boolean {
  return ['RECEIVED', 'WRAPPED', 'TAGGED', 'READY_FOR_DISTRIBUTION', 'DISTRIBUTED', 'PICKED_UP'].includes(status);
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

function addRecentAction(actions: RecentDropoffAction[], action: RecentDropoffAction): RecentDropoffAction[] {
  return [action, ...actions.filter((item) => item.giftId !== action.giftId)].slice(0, 5);
}

function toDropoffLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (error instanceof ApiError && error.status === 410 && normalized.includes('revoked')) {
    return 'This sponsor QR link was revoked. Ask a campaign manager to regenerate and resend the sponsor drop-off link.';
  }
  if (error instanceof ApiError && error.status === 410 && normalized.includes('expired')) {
    return 'This sponsor QR link is expired. Ask a campaign manager to regenerate and resend the sponsor drop-off link.';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'This sponsor QR link was not found. Confirm the sponsor email is the latest one, or ask a campaign manager to regenerate the link.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'You do not have permission to receive gifts for this campaign. Ask a campaign manager to update your access.';
  }
  return message || 'Unable to open sponsor drop-off link.';
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
