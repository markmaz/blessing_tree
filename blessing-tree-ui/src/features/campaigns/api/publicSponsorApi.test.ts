import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commitVerifiedPublicSponsorGifts,
  getPublicSponsorConfig,
  submitPublicSponsorRegistration,
  verifyPublicSponsorRegistration,
} from '@/features/campaigns/api/publicSponsorApi';

describe('publicSponsorApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps public sponsor config registration fields to the frontend contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign: {
          id: 'campaign-1',
          name: 'Holiday 2026',
          year: 2026,
          season_theme: 'Warm Wishes',
        },
        public_slug: 'holiday-2026',
        signup_enabled: true,
        registration: {
          status: 'BLOCKED',
          message: 'Sponsor registration is missing required campaign milestones.',
          missing_milestones: ['gift_intake_end'],
        },
        gift_deadline: null,
        selection_limit: 3,
        whole_item_only: true,
        available_items: [],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const config = await getPublicSponsorConfig('holiday-2026');

    expect(config.registration).toEqual({
      status: 'BLOCKED',
      message: 'Sponsor registration is missing required campaign milestones.',
      startsOn: null,
      endsOn: null,
      missingMilestones: ['gift_intake_end'],
    });
  });

  it('maps submission email delivery status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        pending_registration_id: 'pending-1',
        email: 'sponsor@example.com',
        status: 'pending_verification',
        email_delivery_status: 'failed',
        expires_at: '2026-05-24T12:00:00',
        verification_sent_at: '2026-05-23T12:00:00',
        message: 'Your sponsor signup was received, but the verification email could not be sent.',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitPublicSponsorRegistration('holiday-2026', {
      firstName: 'Jordan',
      lastName: 'Miles',
      organizationName: '',
      email: 'sponsor@example.com',
      phone: '',
      preferredContact: 'EMAIL',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      notes: '',
      selectedWishlistItemIds: ['item-1'],
    });

    expect(result.emailDeliveryStatus).toBe('failed');
    expect(result.message).toMatch(/verification email could not be sent/i);
  });

  it('maps snake-case verified sponsor payloads to the public verification screen contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign: {
          id: 'campaign-1',
          name: 'Holiday 2026',
          year: 2026,
          season_theme: null,
        },
        registration: {
          id: 'registration-1',
          status: 'VERIFIED',
          verified_at: '2026-05-23T12:30:00',
          email: 'sponsor@example.com',
        },
        sponsor: {
          id: 'sponsor-1',
          display_name: 'Jordan Miles',
          email: 'sponsor@example.com',
          participation: {
            self_registered: true,
          },
          sponsored_items: [
            {
              id: 'sponsorship-item-1',
              gift: {
                description: 'Art kit',
                category: 'Toys',
                item_type: 'GIFT',
                size: null,
                qty_requested: 1,
                status: 'COMMITTED',
              },
              recipient: {
                id: 'recipient-1',
                display_label: 'Ava Johnson',
                program_recipient_id: 'A-001',
              },
            },
          ],
        },
        gift_deadline: '2026-06-01',
        selection_limit: 3,
        message: 'Verified.',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyPublicSponsorRegistration('holiday-2026', 'token-1');

    expect(result.sponsor.displayName).toBe('Jordan Miles');
    expect(result.sponsor.participation.selfRegistered).toBe(true);
    expect(result.sponsor.sponsoredItems[0].gift?.itemType).toBe('GIFT');
    expect(result.sponsor.sponsoredItems[0].recipient?.displayLabel).toBe('Ava Johnson');
    expect(result.selectionLimit).toBe(3);
  });

  it('posts verified gift selections with the verification token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign: {
          id: 'campaign-1',
          name: 'Holiday 2026',
          year: 2026,
          season_theme: null,
        },
        registration: {
          id: 'registration-1',
          status: 'VERIFIED',
          verified_at: '2026-05-23T12:30:00',
          email: 'sponsor@example.com',
        },
        sponsor: {
          id: 'sponsor-1',
          display_name: 'Jordan Miles',
          email: 'sponsor@example.com',
          participation: {
            self_registered: true,
          },
          sponsored_items: [],
        },
        gift_deadline: null,
        selection_limit: 3,
        message: 'Reserved.',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await commitVerifiedPublicSponsorGifts('holiday-2026', 'token-1', ['item-1']);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/public/campaigns/holiday-2026/sponsors/verified-gifts'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'token-1',
          selected_wishlist_item_ids: ['item-1'],
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
