import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPublicGiftScanLookup,
  updatePublicGiftScanAction,
} from '@/features/gifts/api/giftSearchApi';
import type { GiftScanAction, PublicGiftScanLookup } from '@/features/gifts/model/giftSearchTypes';
import { scanStatusLabel } from '@/features/mobile/model/mobileScanLabels';
import { MobileGiftScanView } from '@/features/mobile/ui/MobileGiftScanView';

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
      setMessage(
        `${response.gift.description} saved as ${scanStatusLabel(response.gift.status)}. Scan the next tag when ready.`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update gift.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MobileGiftScanView
      campaignName={lookup?.campaign.name ?? 'Blessing Tree'}
      labelCode={labelCode}
      message={message}
      notice={lookup?.message ?? null}
      error={error}
      isLoading={isLoading}
      recipientDetails={
        lookup
          ? [
              { label: 'Name', value: lookup.recipient?.displayLabel ?? 'Not assigned' },
              { label: 'Recipient ID', value: lookup.recipient?.programRecipientId ?? 'Not set' },
              { label: 'Group', value: lookup.recipient?.groupLabel ?? 'Not set' },
            ]
          : null
      }
      giftDetails={
        lookup
          ? [
              { label: 'Gift', value: lookup.gift.description },
              { label: 'Status', value: scanStatusLabel(lookup.gift.status) },
              { label: 'Category', value: lookup.gift.category ?? lookup.gift.itemType },
              { label: 'Size', value: lookup.gift.size ?? 'Not set' },
            ]
          : null
      }
      actions={actions}
      notes={notes}
      isSaving={isSaving}
      onNotesChange={setNotes}
      onAction={(action) => void handleAction(action)}
    />
  );
}
