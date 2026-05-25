import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCampaignPeopleWorkspace } from '@/features/campaigns/api/campaignPeopleWorkspaceApi';

describe('campaignPeopleWorkspaceApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps workflow summaries from snake case to the frontend contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        campaign_id: 'campaign-1',
        counts: {
          group_count: 1,
          active_group_count: 1,
          household_count: 1,
          organization_count: 0,
          recipient_count: 1,
          child_count: 1,
          adult_count: 0,
          wishlist_count: 1,
          open_item_count: 1,
          sponsored_item_count: 0,
          fulfilled_item_count: 0,
          ready_for_pickup_item_count: 0,
          picked_up_item_count: 0,
          recipients_covered_count: 0,
          recipients_needing_gifts_count: 1,
          groups_with_pickup_contacts_count: 0,
          groups_missing_primary_contact_count: 1,
          adults_with_direct_contact_count: 0,
        },
        groups: [
          {
            id: 'group-1',
            campaign_id: 'campaign-1',
            group_type: 'HOUSEHOLD',
            group_name: 'Jones Family',
            organization_type: null,
            program_abbreviation: null,
            intake_source: null,
            external_reference: null,
            notes: null,
            status: 'ACTIVE',
            address_line1: null,
            address_line2: null,
            city: null,
            state: null,
            postal_code: null,
            primary_contact: null,
            contacts: [],
            authorized_pickup_contacts: [],
            recipient_count: 1,
            workflow_summary: workflowSummaryResponse(),
            recipients: [],
            created_at: null,
            updated_at: null,
          },
        ],
        recipients: [
          {
            id: 'recipient-1',
            campaign_id: 'campaign-1',
            recipient_group_id: 'group-1',
            recipient_kind: 'CHILD',
            program_type: 'CHILD_FAMILY',
            privacy_level: 'FULL_NAME',
            display_label: 'Sam Jones',
            program_recipient_number: null,
            program_recipient_id: null,
            first_name: 'Sam',
            last_name: 'Jones',
            birth_year: null,
            age: 8,
            age_unit: 'YEARS',
            gender: 'M',
            address_line1: null,
            address_line2: null,
            city: null,
            state: null,
            postal_code: null,
            direct_email: null,
            direct_phone: null,
            facility_room: null,
            subgroup_label: null,
            mobility_notes: null,
            notes: null,
            status: 'ACTIVE',
            group: {
              id: 'group-1',
              group_name: 'Jones Family',
              group_type: 'HOUSEHOLD',
              organization_type: null,
              status: 'ACTIVE',
            },
            wishlist: null,
            workflow_summary: workflowSummaryResponse(),
            created_at: null,
            updated_at: null,
          },
        ],
        filters: {
          group_types: ['HOUSEHOLD'],
          group_statuses: ['ACTIVE'],
          program_types: ['CHILD_FAMILY'],
          recipient_kinds: ['CHILD'],
          recipient_statuses: ['ACTIVE'],
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const workspace = await getCampaignPeopleWorkspace('campaign-1');

    expect(workspace.groups[0].workflowSummary.openItemCount).toBe(1);
    expect(workspace.recipients[0].workflowSummary.openItemCount).toBe(1);
    expect(workspace.recipients[0].workflowSummary.readyForPickupItemCount).toBe(2);
  });
});

function workflowSummaryResponse() {
  return {
    item_count: 3,
    sponsored_item_count: 1,
    fulfilled_item_count: 2,
    ready_for_pickup_item_count: 2,
    picked_up_item_count: 0,
    open_item_count: 1,
    coverage_rule: 'ALL_GIFTS_SPONSORED',
    coverage_required_count: 3,
    coverage_sponsored_count: 1,
    coverage_remaining_count: 2,
    coverage_met: false,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
