import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPublicGiftScanLookup,
  updatePublicGiftScanAction,
} from '@/features/gifts/api/giftSearchApi';

describe('giftSearchApi public scan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps public gift scan lookup payloads to the frontend contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign: {
          id: 'campaign-1',
          name: 'Holiday 2026',
          year: 2026,
        },
        gift: {
          wishlist_item_id: 'gift-1',
          description: 'Building blocks',
          category: 'Toy',
          item_type: 'GIFT',
          size: null,
          status: 'READY_FOR_DISTRIBUTION',
          label_code: 'LABEL-1',
        },
        recipient: {
          id: 'recipient-1',
          display_label: 'Ava Johnson',
          program_recipient_id: 'CH-001',
          recipient_kind: 'CHILD',
          program_type: 'CHILD_FAMILY',
          group_label: 'Johnson Family',
        },
        scan_path: '/public/gifts/scan/LABEL-1',
        available_actions: ['PICKUP', 'EXCEPTION'],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const lookup = await getPublicGiftScanLookup('LABEL-1');

    expect(lookup.gift).toMatchObject({
      wishlistItemId: 'gift-1',
      itemType: 'GIFT',
      labelCode: 'LABEL-1',
    });
    expect(lookup.recipient?.displayLabel).toBe('Ava Johnson');
    expect(lookup.recipient?.groupLabel).toBe('Johnson Family');
    expect(lookup.scanPath).toBe('/public/gifts/scan/LABEL-1');
    expect(lookup.availableActions).toEqual(['PICKUP', 'EXCEPTION']);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/public/gifts/scan/LABEL-1',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('posts public scan actions without requiring an authenticated retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign: {
          id: 'campaign-1',
          name: 'Holiday 2026',
          year: 2026,
        },
        gift: {
          wishlist_item_id: 'gift-1',
          description: 'Building blocks',
          category: 'Toy',
          item_type: 'GIFT',
          size: null,
          status: 'PICKED_UP',
          label_code: 'LABEL-1',
        },
        recipient: null,
        scan_path: '/public/gifts/scan/LABEL-1',
        available_actions: [],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const lookup = await updatePublicGiftScanAction('LABEL-1', 'PICKUP', ' Parking lot handoff. ');

    expect(lookup.gift.status).toBe('PICKED_UP');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/public/gifts/scan/LABEL-1/actions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          action: 'PICKUP',
          notes: 'Parking lot handoff.',
        }),
      })
    );
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
