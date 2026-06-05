import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getSponsorDropoffPayload,
  updateCampaignGiftOperation,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftOperationsItem, SponsorDropoffGift, SponsorDropoffPayload } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';

export function MobileSponsorDropoffPage() {
  const { token = '' } = useParams();
  const { selectedCampaignId } = useCampaigns();
  const [payload, setPayload] = useState<SponsorDropoffPayload | null>(null);
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [receiveNote, setReceiveNote] = useState('');
  const [busyGiftId, setBusyGiftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDropoff = useCallback(async () => {
    if (!selectedCampaignId || !token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      setPayload(await getSponsorDropoffPayload(selectedCampaignId, token));
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to open sponsor drop-off link.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCampaignId, token]);

  useEffect(() => {
    void loadDropoff();
  }, [loadDropoff]);

  async function handleReceive(gift: SponsorDropoffGift) {
    if (!selectedCampaignId || !gift.canReceive) return;
    setBusyGiftId(gift.wishlistItemId);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCampaignGiftOperation(
        selectedCampaignId,
        gift.wishlistItemId,
        'receive',
        activeNoteItemId === gift.wishlistItemId ? receiveNote : undefined
      );
      replaceGift(updated);
      setActiveNoteItemId(null);
      setReceiveNote('');
      setMessage(`${updated.description} marked received.`);
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'Unable to receive gift.');
    } finally {
      setBusyGiftId(null);
    }
  }

  async function handleUnreceive(gift: SponsorDropoffGift) {
    if (!selectedCampaignId || !gift.canUnreceive) return;
    setBusyGiftId(gift.wishlistItemId);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCampaignGiftOperation(
        selectedCampaignId,
        gift.wishlistItemId,
        'unreceive',
        'Corrected accidental sponsor drop-off receive.'
      );
      replaceGift(updated);
      setMessage(`${updated.description} moved back to ${toStatusLabel(updated.status)}.`);
    } catch (unreceiveError) {
      setError(unreceiveError instanceof Error ? unreceiveError.message : 'Unable to undo receive.');
    } finally {
      setBusyGiftId(null);
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

      {!selectedCampaignId ? (
        <div className="mobile-alert mobile-alert--danger">Select a campaign before receiving gifts.</div>
      ) : null}
      {isLoading ? <div className="mobile-alert mobile-scan-notice">Loading sponsor drop-off...</div> : null}
      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}
      {message ? <div className="mobile-alert mobile-alert--success">{message}</div> : null}

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
                  const isBusy = busyGiftId === gift.wishlistItemId;
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
