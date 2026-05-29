import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignPeopleRecipientDrawer } from '@/features/campaigns/ui/CampaignPeopleRecipientDrawer';
import type { CampaignPeopleGroup, CampaignRecipient } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

const householdGroup: CampaignPeopleGroup = {
  id: 'group-household',
  campaignId: 'campaign-1',
  groupType: 'HOUSEHOLD',
  groupName: 'Johnson Household',
  organizationType: null,
  programAbbreviation: null,
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

const organizationGroup: CampaignPeopleGroup = {
  id: 'group-program',
  campaignId: 'campaign-1',
  groupType: 'ORGANIZATION',
  groupName: 'Senior At Home',
  organizationType: 'SENIOR_PROGRAM',
  programAbbreviation: 'SAH',
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

const childOrganizationGroup: CampaignPeopleGroup = {
  ...organizationGroup,
  id: 'group-youth',
  groupName: 'Youth Shelter',
  organizationType: 'YOUTH_SHELTER',
};

const childOrganizationTypes = [
  {
    id: 'org-type-youth',
    code: 'YOUTH_SHELTER',
    label: 'Youth Shelter',
    recipientCategory: 'CHILD' as const,
    isActive: true,
    sortOrder: 15,
    createdAt: null,
    updatedAt: null,
  },
];

const existingAdultRecipient: CampaignRecipient = {
  id: 'recipient-1',
  campaignId: 'campaign-1',
  recipientGroupId: 'group-program',
  recipientKind: 'ADULT',
  programType: 'ORGANIZATION_ADULT',
  privacyLevel: 'FULL_NAME',
  displayLabel: 'Mary Smith',
  programRecipientNumber: 1,
  programRecipientId: 'SAH-001',
  firstName: 'Mary',
  lastName: 'Smith',
  birthYear: 1942,
  age: 84,
  ageUnit: 'YEARS',
  gender: 'F',
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  directEmail: null,
  directPhone: null,
  facilityRoom: null,
  subgroupLabel: null,
  mobilityNotes: null,
  notes: null,
  status: 'ACTIVE',
  group: {
    id: 'group-program',
    groupName: 'Senior At Home',
    groupType: 'ORGANIZATION',
    organizationType: 'SENIOR_PROGRAM',
    status: 'ACTIVE',
  },
  wishlist: null,
  workflowSummary: {
    itemCount: 0,
    sponsoredItemCount: 0,
    fulfilledItemCount: 0,
    readyForPickupItemCount: 0,
    pickedUpItemCount: 0,
    openItemCount: 0,
  },
  createdAt: null,
  updatedAt: null,
};

const existingAdultRecipientWithWishlist: CampaignRecipient = {
  ...existingAdultRecipient,
  wishlist: {
    id: 'wishlist-1',
    campaignId: 'campaign-1',
    recipientId: 'recipient-1',
    wishlistStatus: 'READY',
    intakeMethod: 'STAFF_ENTRY',
    submittedAt: '2026-05-20T10:00:00Z',
    intakeCompletedByContactId: null,
    intakeCompletedByContact: null,
    notes: 'Needs warm blankets.',
    items: [
      {
        id: 'item-1',
        wishlistId: 'wishlist-1',
        category: 'Comfort',
        itemType: 'GIFT',
        description: 'Warm blanket',
        size: null,
        qtyRequested: 1,
        priority: 'HIGH',
        estCostCents: 2500,
        allowSubstitute: true,
        doNotSubstituteReason: null,
        recipientNote: null,
        status: 'OPEN',
        qtyFulfilled: 0,
        notes: null,
        giftWorkflow: {
          sponsorshipStatus: 'UNSPONSORED',
          sponsorshipId: null,
          qtyCommitted: 0,
          qtyFulfilled: 0,
          remainingQty: 1,
          isFullyFulfilled: false,
          isPickedUp: false,
          pickedUpAt: null,
          pickedUpByContactId: null,
          labelCode: 'LBL-001',
          labelVersion: 1,
          labelLastPrintedAt: null,
          labelPrintCount: 0,
        },
        createdAt: '2026-05-20T10:00:00Z',
        updatedAt: '2026-05-21T11:00:00Z',
      },
    ],
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-21T11:00:00Z',
  },
};

const existingHouseholdChildWithWishlist: CampaignRecipient = {
  ...existingAdultRecipientWithWishlist,
  id: 'recipient-child-1',
  recipientGroupId: 'group-household',
  recipientKind: 'CHILD',
  programType: 'CHILD_FAMILY',
  displayLabel: 'Child One',
  programRecipientNumber: null,
  programRecipientId: null,
  firstName: 'Child',
  lastName: 'One',
  birthYear: new Date().getFullYear() - 8,
  age: 8,
  group: {
    id: 'group-household',
    groupName: 'Johnson Household',
    groupType: 'HOUSEHOLD',
    organizationType: null,
    status: 'ACTIVE',
  },
  wishlist: {
    ...existingAdultRecipientWithWishlist.wishlist!,
    id: 'wishlist-child-1',
    recipientId: 'recipient-child-1',
    items: [
      {
        ...existingAdultRecipientWithWishlist.wishlist!.items[0],
        id: 'item-child-1',
        wishlistId: 'wishlist-child-1',
        description: 'Art kit',
      },
    ],
  },
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
        recipients={[]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    expect(screen.getByText('Child Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Johnson Household')).toBeInTheDocument();
    expect(screen.getByLabelText('Child Label')).toHaveValue('Assigned after save');
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toHaveDisplayValue('Not set');
    expect(screen.queryByLabelText('Direct Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Direct Phone')).not.toBeInTheDocument();
  });

  it('uses organization framing and shows direct contact fields for adult intake', () => {
    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-program"
        lockedGroupId="group-program"
        groups={[organizationGroup]}
        recipients={[]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
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

  it('uses the organization people-served category for child organization intake labels', () => {
    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-youth"
        lockedGroupId="group-youth"
        groups={[childOrganizationGroup]}
        recipients={[]}
        organizationTypes={childOrganizationTypes}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Child' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add Adult' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Child Label')).toHaveValue('Assigned after save');
    expect(screen.getByLabelText('Program')).toHaveValue('Organization Child');
    expect(screen.queryByLabelText('Direct Email')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Child' })).toBeInTheDocument();
  });

  it('derives display name from first and last name and supports age units', async () => {
    const user = userEvent.setup();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-program"
        lockedGroupId="group-program"
        groups={[organizationGroup]}
        recipients={[]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('First Name'), 'Ava');
    await user.type(screen.getByLabelText('Last Name'), 'Johnson');
    await user.type(screen.getByLabelText('Age'), '8');
    await user.selectOptions(screen.getByLabelText('Age Unit'), 'MONTHS');

    expect(screen.getByLabelText('Adult Display Name')).toHaveValue('Ava Johnson');
    expect(screen.getByLabelText('Age Unit')).toHaveValue('MONTHS');
  });

  it('shows possible duplicate recipients during adult intake', async () => {
    const user = userEvent.setup();
    const onSelectExistingRecipient = vi.fn();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-program"
        lockedGroupId="group-program"
        groups={[organizationGroup]}
        recipients={[existingAdultRecipient]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={onSelectExistingRecipient}
      />
    );

    await user.type(screen.getByLabelText('First Name'), 'Mary');
    await user.type(screen.getByLabelText('Last Name'), 'Smith');
    await user.type(screen.getByLabelText('Age'), '84');

    expect(screen.getByText('Possible existing people')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /mary smith/i }));
    expect(onSelectExistingRecipient).toHaveBeenCalledWith('recipient-1');
  });

  it('starts profile collapsed on edit, keeps wishlist metadata collapsed, and edits gifts in a modal', async () => {
    const user = userEvent.setup();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={existingAdultRecipientWithWishlist}
        groups={[organizationGroup]}
        recipients={[existingAdultRecipientWithWishlist]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Intake Method')).not.toBeVisible();
    expect(screen.queryByLabelText('Wishlist Notes')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Wishlist Status')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Gift for Adult' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Expand person details'));
    expect(screen.getByLabelText('First Name')).toHaveValue('Mary');

    await user.click(screen.getByText('Wishlist Metadata'));
    expect(screen.getByLabelText('Intake Method')).toHaveValue('Staff Entry');

    await user.click(screen.getByRole('button', { name: /warm blanket/i }));
    expect(screen.getByRole('heading', { name: 'Edit Gift Item' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Warm blanket');
  });

  it('shows a direct delete action for wishlist gifts in the adult drawer table', async () => {
    const user = userEvent.setup();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={existingAdultRecipientWithWishlist}
        groups={[organizationGroup]}
        recipients={[existingAdultRecipientWithWishlist]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    const giftRow = screen.getByRole('button', { name: /warm blanket/i });
    const giftDeleteButton = within(giftRow).getByRole('button');
    await user.click(giftDeleteButton);
    expect(screen.getByText('Delete Gift Item')).toBeInTheDocument();
    expect(screen.getByText('Gift item: Warm blanket')).toBeInTheDocument();
  });

  it('keeps the saved child details available after saving instead of resetting to a blank child', async () => {
    const user = userEvent.setup();
    const onSaveRecipient = vi.fn().mockResolvedValue({
      ...existingAdultRecipient,
      id: 'recipient-new',
      recipientGroupId: 'group-household',
      recipientKind: 'CHILD',
      programType: 'CHILD_FAMILY',
      displayLabel: 'Child One',
      firstName: 'Child',
      lastName: 'One',
      age: 8,
      birthYear: new Date().getFullYear() - 8,
      group: {
        id: 'group-household',
        groupName: 'Johnson Household',
        groupType: 'HOUSEHOLD',
        organizationType: null,
        status: 'ACTIVE',
      },
      wishlist: null,
    });

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={null}
        initialGroupId="group-household"
        lockedGroupId="group-household"
        groups={[householdGroup]}
        recipients={[]}
        onClose={vi.fn()}
        onSaveRecipient={onSaveRecipient}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Child Label')).toHaveValue('Assigned after save');
    await user.type(screen.getByLabelText('Age'), '8');
    await user.click(screen.getByRole('button', { name: 'Create Child' }));

    await waitFor(() => {
      expect(onSaveRecipient).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Child added.')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toHaveValue(8);
    expect(screen.getByDisplayValue('Johnson Household')).toBeInTheDocument();
  });

  it('offers a direct add-gift action after saving a child in a family intake flow', async () => {
    const user = userEvent.setup();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={existingHouseholdChildWithWishlist}
        initialGroupId="group-household"
        lockedGroupId="group-household"
        groups={[householdGroup]}
        recipients={[existingHouseholdChildWithWishlist]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add Gift for Child' }));
    expect(screen.getByRole('heading', { name: 'Add Gift Item' })).toBeInTheDocument();
  });

  it('can automatically open the gift editor when a newly saved child is reopened', async () => {
    const onGiftEditorAutoOpened = vi.fn();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={existingHouseholdChildWithWishlist}
        initialGroupId="group-household"
        lockedGroupId="group-household"
        groups={[householdGroup]}
        recipients={[existingHouseholdChildWithWishlist]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
        openGiftEditorOnMount
        onGiftEditorAutoOpened={onGiftEditorAutoOpened}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Add Gift Item' })).toBeInTheDocument();
    expect(onGiftEditorAutoOpened).toHaveBeenCalledTimes(1);
  });

  it('offers a direct add-another-child action after saving a child in a family intake flow', async () => {
    const user = userEvent.setup();
    const onStartAnotherRecipient = vi.fn();

    render(
      <CampaignPeopleRecipientDrawer
        isOpen
        isSaving={false}
        canEdit
        recipient={existingHouseholdChildWithWishlist}
        initialGroupId="group-household"
        lockedGroupId="group-household"
        groups={[householdGroup]}
        recipients={[existingHouseholdChildWithWishlist]}
        onClose={vi.fn()}
        onSaveRecipient={vi.fn()}
        onSaveWishlistItem={vi.fn()}
        onDeleteWishlistItem={vi.fn()}
        onDeleteRecipient={vi.fn()}
        onSelectExistingRecipient={vi.fn()}
        onStartAnotherRecipient={onStartAnotherRecipient}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Add Another Child' })[0]);
    expect(onStartAnotherRecipient).toHaveBeenCalledTimes(1);
  });
});
