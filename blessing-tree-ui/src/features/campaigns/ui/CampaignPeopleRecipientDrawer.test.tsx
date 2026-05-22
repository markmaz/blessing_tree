import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignPeopleRecipientDrawer } from '@/features/campaigns/ui/CampaignPeopleRecipientDrawer';
import type { CampaignPeopleGroup } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

const householdGroup: CampaignPeopleGroup = {
  id: 'group-household',
  campaignId: 'campaign-1',
  groupType: 'HOUSEHOLD',
  groupName: 'Johnson Household',
  intakeSource: null,
  externalReference: null,
  notes: null,
  status: 'ACTIVE',
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  primaryContact: null,
  contacts: [],
  authorizedPickupContacts: [],
  recipientCount: 0,
  recipients: [],
  createdAt: null,
  updatedAt: null,
};

describe('CampaignPeopleRecipientDrawer', () => {
  it('uses child-intake framing and hides direct contact fields for a household intake', () => {
    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-household"
        lockedGroupId="group-household"
        groups={[householdGroup]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlist={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
      />
    );

    expect(screen.getByText('Child Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Johnson Household')).toBeInTheDocument();
    expect(screen.getByLabelText('Child Display Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Direct Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Direct Phone')).not.toBeInTheDocument();
  });
});
