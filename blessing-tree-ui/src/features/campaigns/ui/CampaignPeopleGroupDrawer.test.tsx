import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignPeopleGroupDrawer } from '@/features/campaigns/ui/CampaignPeopleGroupDrawer';
import type { CampaignPeopleGroup } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

const organizationGroup: CampaignPeopleGroup = {
  id: 'group-1',
  campaignId: 'campaign-1',
  groupType: 'ORGANIZATION',
  groupName: 'Maple Grove',
  organizationType: 'SENIOR_PROGRAM',
  programAbbreviation: 'MG',
  intakeSource: null,
  externalReference: null,
  notes: null,
  status: 'ACTIVE',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
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

const householdGroup: CampaignPeopleGroup = {
  id: 'group-household',
  campaignId: 'campaign-1',
  groupType: 'HOUSEHOLD',
  groupName: 'Johnson Family',
  organizationType: null,
  programAbbreviation: null,
  intakeSource: null,
  externalReference: null,
  notes: null,
  status: 'ACTIVE',
  addressLine1: '10 Oak St',
  addressLine2: null,
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  primaryContact: {
    id: 'contact-primary',
    recipientGroupId: 'group-household',
    displayName: 'Mary Johnson',
    contactRole: 'PARENT',
    relationshipLabel: null,
    firstName: 'Mary',
    lastName: 'Johnson',
    email: 'mary@example.com',
    phone: '555-111-2222',
    preferredContact: 'PHONE',
    isPrimary: true,
    canPickUp: true,
    isEmergencyContact: false,
    notes: null,
    createdAt: null,
    updatedAt: null,
  },
  contacts: [
    {
      id: 'contact-primary',
      recipientGroupId: 'group-household',
      displayName: 'Mary Johnson',
      contactRole: 'PARENT',
      relationshipLabel: null,
      firstName: 'Mary',
      lastName: 'Johnson',
      email: 'mary@example.com',
      phone: '555-111-2222',
      preferredContact: 'PHONE',
      isPrimary: true,
      canPickUp: true,
      isEmergencyContact: false,
      notes: null,
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'contact-secondary',
      recipientGroupId: 'group-household',
      displayName: 'Mark Johnson',
      contactRole: 'GUARDIAN',
      relationshipLabel: null,
      firstName: 'Mark',
      lastName: 'Johnson',
      email: 'mark@example.com',
      phone: '555-333-4444',
      preferredContact: 'EMAIL',
      isPrimary: false,
      canPickUp: true,
      isEmergencyContact: false,
      notes: null,
      createdAt: null,
      updatedAt: null,
    },
  ],
  authorizedPickupContacts: [
    {
      id: 'contact-secondary',
      recipientGroupId: 'group-household',
      displayName: 'Mark Johnson',
      contactRole: 'GUARDIAN',
      relationshipLabel: null,
      firstName: 'Mark',
      lastName: 'Johnson',
      email: 'mark@example.com',
      phone: '555-333-4444',
      preferredContact: 'EMAIL',
      isPrimary: false,
      canPickUp: true,
      isEmergencyContact: false,
      notes: null,
      createdAt: null,
      updatedAt: null,
    },
  ],
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

describe('CampaignPeopleGroupDrawer', () => {
  it('uses family-specific labels for household intake', () => {
    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        groups={[]}
        initialGroupType="HOUSEHOLD"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Family' })).toBeInTheDocument();
    expect(screen.getByLabelText('Guardian First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Guardian Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Family Name')).toHaveDisplayValue('Enter guardian surname');
  });

  it('uses organization-specific labels and can apply an address suggestion', async () => {
    const user = userEvent.setup();
    const onSearchAddresses = vi.fn().mockResolvedValue([
      {
        label: '123 Main St, Austin, TX, 78701',
        addressLine1: '123 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
    ]);

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        groups={[]}
        initialGroupType="ORGANIZATION"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Organization' })).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Program Abbreviation')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Address Line 1'), '123 Main');

    await waitFor(() => {
      expect(onSearchAddresses).toHaveBeenCalledWith('123 Main');
    });

    await user.click(screen.getByRole('button', { name: /123 main st, austin, tx, 78701/i }));

    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Austin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TX')).toBeInTheDocument();
    expect(screen.getByDisplayValue('78701')).toBeInTheDocument();
  });

  it('uses organization-specific labels for organization intake', () => {
    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        groups={[]}
        initialGroupType="ORGANIZATION"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Organization' })).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
  });

  it('does not search just by opening an existing organization record with an address', async () => {
    const onSearchAddresses = vi.fn().mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={organizationGroup}
        groups={[organizationGroup]}
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('Expand group details'));
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();

    expect(onSearchAddresses).not.toHaveBeenCalled();
  });

  it('shows possible duplicate groups while creating a new organization', async () => {
    const user = userEvent.setup();
    const onSelectGroup = vi.fn();

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        groups={[organizationGroup]}
        initialGroupType="ORGANIZATION"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={onSelectGroup}
        onSelectRecipient={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Organization Name'), 'Maple Grove');

    expect(screen.getByText('Possible existing records')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /maple grove/i })[0]);
    expect(onSelectGroup).toHaveBeenCalledWith('group-1');
  });

  it('derives the family name from the guardian surname and saves the primary guardian with the household', async () => {
    const user = userEvent.setup();
    const onSaveGroup = vi.fn().mockResolvedValue({
      ...organizationGroup,
      id: 'group-household',
      groupType: 'HOUSEHOLD',
      groupName: 'Johnson Family',
      organizationType: null,
      programAbbreviation: null,
    });
    const onSaveContact = vi.fn().mockResolvedValue({
      id: 'contact-1',
      recipientGroupId: 'group-household',
      displayName: 'Mary Johnson',
      contactRole: 'PARENT',
      relationshipLabel: null,
      firstName: 'Mary',
      lastName: 'Johnson',
      email: 'mary@example.com',
      phone: '555-111-2222',
      preferredContact: 'PHONE',
      isPrimary: true,
      canPickUp: true,
      isEmergencyContact: false,
      notes: null,
      createdAt: null,
      updatedAt: null,
    });

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        groups={[]}
        initialGroupType="HOUSEHOLD"
        onClose={vi.fn()}
        onSaveGroup={onSaveGroup}
        onSaveContact={onSaveContact}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Guardian First Name'), 'Mary');
    await user.type(screen.getByLabelText('Guardian Last Name'), 'Johnson');
    await user.type(screen.getByLabelText('Guardian Email'), 'mary@example.com');
    await user.type(screen.getByLabelText('Guardian Phone'), '555-111-2222');

    expect(screen.getByLabelText('Family Name')).toHaveDisplayValue('Johnson Family');

    await user.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() => {
      expect(onSaveGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          groupType: 'HOUSEHOLD',
          groupName: 'Johnson Family',
        }),
        undefined
      );
    });

    await waitFor(() => {
      expect(onSaveContact).toHaveBeenCalledWith(
        'group-household',
        expect.objectContaining({
          contactRole: 'PARENT',
          firstName: 'Mary',
          lastName: 'Johnson',
          email: 'mary@example.com',
          phone: '555-111-2222',
          isPrimary: true,
        }),
        undefined
      );
    });
  });

  it('starts family details and additional contacts collapsed when editing an existing household', async () => {
    const user = userEvent.setup();

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={householdGroup}
        groups={[householdGroup]}
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Guardian First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.getByText('Mary Johnson')).toBeInTheDocument();
    expect(screen.getByText('1 additional contacts')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Expand group details'));
    expect(screen.getByLabelText('Guardian First Name')).toHaveValue('Mary');

    await user.click(screen.getByLabelText('Expand additional contacts'));
    expect(screen.getByLabelText('First Name')).toHaveValue('');
    expect(screen.getAllByText('Mark Johnson').length).toBeGreaterThan(0);
  });
});
