import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  workflowSummary: {
    itemCount: 0,
    sponsoredItemCount: 0,
    fulfilledItemCount: 0,
    readyForPickupItemCount: 0,
    pickedUpItemCount: 0,
    openItemCount: 0,
  },
  recipients: [],
  createdAt: null,
  updatedAt: null,
};

const partnerProgramGroup: CampaignPeopleGroup = {
  id: 'group-program',
  campaignId: 'campaign-1',
  groupType: 'ADULT_PROGRAM',
  groupName: 'Senior At Home',
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
  workflowSummary: {
    itemCount: 0,
    sponsoredItemCount: 0,
    fulfilledItemCount: 0,
    readyForPickupItemCount: 0,
    pickedUpItemCount: 0,
    openItemCount: 0,
  },
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
    expect(screen.getByLabelText('Gender')).toHaveDisplayValue('Not set');
    expect(screen.queryByLabelText('Direct Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Direct Phone')).not.toBeInTheDocument();
  });

  it('uses adult-program framing and shows direct contact fields for adult intake', () => {
    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-program"
        lockedGroupId="group-program"
        groups={[partnerProgramGroup]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlist={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Adult' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Senior At Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Adult Display Name')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Female' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Male' })).toBeInTheDocument();
    expect(screen.getByLabelText('Home Address Line 1')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('Direct Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Direct Phone')).toBeInTheDocument();
  });

  it('derives display name from first and last name and birth year from age', async () => {
    const user = userEvent.setup();

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

    await user.type(screen.getByLabelText('First Name'), 'Ava');
    await user.type(screen.getByLabelText('Last Name'), 'Johnson');
    await user.type(screen.getByLabelText('Age'), '8');

    expect(screen.getByLabelText('Child Display Name')).toHaveValue('Ava Johnson');
    expect(screen.getByLabelText('Birth Year')).toHaveValue(new Date().getFullYear() - 8);
  });
});
