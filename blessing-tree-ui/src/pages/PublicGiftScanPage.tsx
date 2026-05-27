import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPublicGiftScanLookup,
  updatePublicGiftScanAction,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftScanAction, PublicGiftScanLookup } from '@/features/gifts/model/giftSearchTypes';
import '@/features/gifts/ui/publicGiftScan.css';

const PRIMARY_ACTIONS: GiftScanAction[] = ['PICKUP', 'DISTRIBUTE', 'READY', 'WRAP', 'RECEIVE'];

export function PublicGiftScanPage() {
  const { labelCode = '' } = useParams();
  const [lookup, setLookup] = useState<PublicGiftScanLookup | null>(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadGift = useCallback(async () => {
    if (!labelCode) {
      setError('Gift label is missing.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setLookup(await getPublicGiftScanLookup(labelCode));
    } catch (loadError) {
      setLookup(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load gift label.');
    } finally {
      setIsLoading(false);
    }
  }, [labelCode]);

  useEffect(() => {
    void loadGift();
  }, [loadGift]);

  const actions = useMemo(() => {
    const availableActions = lookup?.availableActions ?? [];
    return [
      ...PRIMARY_ACTIONS.filter((action) => availableActions.includes(action)),
      ...availableActions.filter((action) => !PRIMARY_ACTIONS.includes(action) && action !== 'REPRINT'),
    ];
  }, [lookup?.availableActions]);

  async function handleAction(action: GiftScanAction) {
    if (!labelCode) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await updatePublicGiftScanAction(labelCode, action, notes);
      setLookup(response);
      setNotes('');
      setMessage(`${response.gift.description} saved as ${statusLabel(response.gift.status)}. Scan the next tag when ready.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update gift.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="public-gift-scan">
      <div className="public-gift-scan__shell">
        <header className="public-gift-scan__header">
          <div>
            <div className="public-gift-scan__eyebrow">Gift Scan</div>
            <h1>{lookup?.campaign.name ?? 'Blessing Tree'}</h1>
          </div>
          <span className="public-gift-scan__label">{labelCode || 'No label'}</span>
        </header>

        {message ? (
          <div className="public-gift-scan__notice public-gift-scan__notice--success" role="status">
            <i className="bi bi-check2-circle" aria-hidden="true" />
            <span>{message}</span>
          </div>
        ) : null}
        {lookup?.message ? (
          <div className="public-gift-scan__notice" role="status">
            <i className="bi bi-info-circle" aria-hidden="true" />
            <span>{lookup.message}</span>
          </div>
        ) : null}
        {error ? (
          <div className="public-gift-scan__notice public-gift-scan__notice--danger" role="alert">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoading && !lookup ? (
          <div className="public-gift-scan__panel">
            <p className="mb-0 text-muted">Loading gift label...</p>
          </div>
        ) : lookup ? (
          <>
            <section className="public-gift-scan__panel">
              <div className="public-gift-scan__section-title">Recipient Info</div>
              <dl className="public-gift-scan__details">
                <div>
                  <dt>Name</dt>
                  <dd>{lookup.recipient?.displayLabel ?? 'Not assigned'}</dd>
                </div>
                <div>
                  <dt>Recipient ID</dt>
                  <dd>{lookup.recipient?.programRecipientId ?? 'Not set'}</dd>
                </div>
                <div>
                  <dt>Group</dt>
                  <dd>{lookup.recipient?.groupLabel ?? 'Not set'}</dd>
                </div>
              </dl>
            </section>

            <section className="public-gift-scan__panel">
              <div className="public-gift-scan__section-title">Gift Info</div>
              <dl className="public-gift-scan__details">
                <div>
                  <dt>Gift</dt>
                  <dd>{lookup.gift.description}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(lookup.gift.status)}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{lookup.gift.category ?? lookup.gift.itemType}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{lookup.gift.size ?? 'Not set'}</dd>
                </div>
              </dl>
            </section>

            <section className="public-gift-scan__panel public-gift-scan__actions-panel">
              <div className="public-gift-scan__section-title">Available Actions</div>
              <label className="public-gift-scan__notes">
                Notes
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="public-gift-scan__actions">
                {actions.length ? (
                  actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`public-gift-scan__action ${action === 'EXCEPTION' ? 'is-danger' : ''}`}
                      disabled={isSaving}
                      onClick={() => void handleAction(action)}
                    >
                      <i className={`bi ${actionIcon(action)}`} aria-hidden="true" />
                      <span>{actionLabel(action)}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-muted mb-0">No more actions are available for this gift.</p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function actionLabel(action: GiftScanAction): string {
  if (action === 'PICKUP') return 'Mark Picked Up';
  if (action === 'DISTRIBUTE') return 'Mark Distributed';
  if (action === 'READY') return 'Mark Ready';
  if (action === 'WRAP') return 'Mark Wrapped';
  if (action === 'RECEIVE') return 'Mark Received';
  return 'Report Exception';
}

function actionIcon(action: GiftScanAction): string {
  if (action === 'PICKUP') return 'bi-person-check';
  if (action === 'DISTRIBUTE') return 'bi-truck';
  if (action === 'READY') return 'bi-check2-circle';
  if (action === 'WRAP') return 'bi-gift';
  if (action === 'RECEIVE') return 'bi-box-arrow-in-down';
  return 'bi-exclamation-triangle';
}

function statusLabel(value: string): string {
  if (value === 'READY_FOR_DISTRIBUTION') return 'Ready';
  if (value === 'UNASSIGNED') return 'Unassigned';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
