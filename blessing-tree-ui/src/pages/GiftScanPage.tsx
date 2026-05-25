import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router-dom';
import {
  getGiftScanLookup,
  updateGiftScanAction,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftScanAction, GiftScanLookup } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/gifts/ui/giftWorkflow.css';

export function GiftScanPage() {
  const { labelCode = '' } = useParams();
  const { selectedCampaignId, selectedCampaign } = useCampaigns();
  const [lookup, setLookup] = useState<GiftScanLookup | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadScan = useCallback(async () => {
    if (!selectedCampaignId || !labelCode) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setLookup(await getGiftScanLookup(selectedCampaignId, labelCode));
    } catch (loadError) {
      setLookup(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load gift label.');
    } finally {
      setIsLoading(false);
    }
  }, [labelCode, selectedCampaignId]);

  useEffect(() => {
    void loadScan();
  }, [loadScan]);

  const actions = useMemo(() => lookup?.availableActions ?? [], [lookup]);

  async function handleAction(action: GiftScanAction) {
    if (!selectedCampaignId || !labelCode) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await updateGiftScanAction(selectedCampaignId, labelCode, action, notes);
      setLookup(response);
      setNotes('');
      setMessage(`${response.gift.description} updated to ${toLabel(response.gift.status)}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update gift.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectedCampaignId) {
    return (
      <div className="campaign-studio-page gift-workflow-page">
        <div className="alert alert-warning" role="alert">
          Select a campaign before scanning gift labels.
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-studio-page gift-workflow-page">
      <div className="campaign-studio-page__header">
        <div>
          <div className="text-uppercase small text-muted fw-semibold mb-1">Gift Scan</div>
          <h1 className="h3 mb-1">{labelCode}</h1>
          <p className="text-muted mb-0">{selectedCampaign?.name ?? 'Selected campaign'} label workflow.</p>
        </div>
      </div>

      {message ? <div className="alert alert-success" role="status">{message}</div> : null}
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

      {isLoading && !lookup ? (
        <p className="text-muted">Loading gift label...</p>
      ) : lookup ? (
        <section className="campaign-team-workspace__section">
          <div className="campaign-team-workspace__section-header">
            <div>
              <h2 className="h5 mb-1">{lookup.gift.description}</h2>
              <p className="text-muted mb-0">
                {lookup.gift.recipient?.displayLabel ?? 'Recipient'} · {toLabel(lookup.gift.status)}
              </p>
            </div>
            <QRCodeSVG value={absoluteScanUrl(lookup.scanPath)} size={92} includeMargin />
          </div>

          <div className="row g-3 mb-3">
            <DrawerDetail label="Recipient ID" value={lookup.gift.recipient?.programRecipientId ?? 'Not set'} />
            <DrawerDetail label="Category" value={lookup.gift.category ?? lookup.gift.itemType} />
            <DrawerDetail label="Size" value={lookup.gift.size ?? 'Not set'} />
            <DrawerDetail label="Label" value={lookup.gift.labelCode ?? labelCode} />
          </div>

          <label className="form-label">
            Scan Notes
            <textarea
              className="form-control mt-2"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <div className="d-grid gap-2 d-sm-flex flex-sm-wrap">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                className={action === 'EXCEPTION' ? 'btn btn-outline-danger' : 'btn btn-secondary'}
                disabled={isSaving}
                onClick={() => void handleAction(action)}
              >
                <i className={`bi ${actionIcon(action)} me-2`} aria-hidden="true" />
                {actionLabel(action)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DrawerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-12 col-md-6">
      <div className="small text-uppercase text-muted fw-semibold">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function actionLabel(action: GiftScanAction): string {
  if (action === 'RECEIVE') return 'Mark Received';
  if (action === 'WRAP') return 'Mark Wrapped';
  if (action === 'READY') return 'Mark Ready';
  if (action === 'DISTRIBUTE') return 'Mark Distributed';
  if (action === 'PICKUP') return 'Mark Picked Up';
  if (action === 'REPRINT') return 'Request Reprint';
  return 'Report Exception';
}

function actionIcon(action: GiftScanAction): string {
  if (action === 'RECEIVE') return 'bi-box-arrow-in-down';
  if (action === 'WRAP') return 'bi-gift';
  if (action === 'READY') return 'bi-check2-circle';
  if (action === 'DISTRIBUTE') return 'bi-truck';
  if (action === 'PICKUP') return 'bi-person-check';
  if (action === 'REPRINT') return 'bi-printer';
  return 'bi-exclamation-triangle';
}

function toLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function absoluteScanUrl(scanPath: string): string {
  if (typeof window === 'undefined') {
    return scanPath;
  }
  return `${window.location.origin}${scanPath}`;
}
