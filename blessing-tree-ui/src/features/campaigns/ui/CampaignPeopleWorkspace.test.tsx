import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampaignPeopleWorkspace } from '@/features/campaigns/ui/CampaignPeopleWorkspace';
import type { CampaignPeopleWorkspaceData } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

const workspaceFixture: CampaignPeopleWorkspaceData = {
  campaignId: 'campaign-1',
  counts: {
    groupCount: 2,
    activeGroupCount: 2,
    householdCount: 1,
    organizationCount: 1,
    recipientCount: 2,
    childCount: 1,
    adultCount: 1,
    wishlistCount: 1,
    openItemCount: 2,
    sponsoredItemCount: 0,
    fulfilledItemCount: 0,
    readyForPickupItemCount: 0,
    pickedUpItemCount: 0,
    groupsWithPickupContactsCount: 1,
    groupsMissingPrimaryContactCount: 1,
    adultsWithDirectContactCount: 1,
  },
  filters: {
    groupTypes: ['ORGANIZATION', 'HOUSEHOLD'],
    groupStatuses: ['ACTIVE'],
    programTypes: ['ORGANIZATION_ADULT', 'CHILD_FAMILY'],
    recipientKinds: ['ADULT', 'CHILD'],
    recipientStatuses: ['ACTIVE'],
  },
  groups: [
    {
      id: 'group-1',
      campaignId: 'campaign-1',
      groupType: 'HOUSEHOLD',
      groupName: 'Johnson Household',
      organizationType: null,
      programAbbreviation: null,
      intakeSource: 'Partner Church',
      externalReference: null,
      notes: null,
      status: 'ACTIVE',
      addressLine1: null,
      addressLine2: null,
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      primaryContact: {
        id: 'contact-1',
        recipientGroupId: 'group-1',
        displayName: 'Jamie Johnson',
        contactRole: 'PARENT',
        relationshipLabel: null,
        firstName: 'Jamie',
        lastName: 'Johnson',
        email: 'jamie@example.com',
        phone: null,
        preferredContact: 'EMAIL',
        isPrimary: true,
        canPickUp: true,
        isEmergencyContact: false,
        notes: null,
        createdAt: null,
        updatedAt: null,
      },
      contacts: [
        {
          id: 'contact-1',
          recipientGroupId: 'group-1',
          displayName: 'Jamie Johnson',
          contactRole: 'PARENT',
          relationshipLabel: null,
          firstName: 'Jamie',
          lastName: 'Johnson',
          email: 'jamie@example.com',
          phone: null,
          preferredContact: 'EMAIL',
          isPrimary: true,
          canPickUp: true,
          isEmergencyContact: false,
          notes: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
      authorizedPickupContacts: [
        {
          id: 'contact-1',
          recipientGroupId: 'group-1',
          displayName: 'Jamie Johnson',
          contactRole: 'PARENT',
          relationshipLabel: null,
          firstName: 'Jamie',
          lastName: 'Johnson',
          email: 'jamie@example.com',
          phone: null,
          preferredContact: 'EMAIL',
          isPrimary: true,
          canPickUp: true,
          isEmergencyContact: false,
          notes: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
      recipientCount: 1,
      workflowSummary: {
        itemCount: 1,
        sponsoredItemCount: 0,
        fulfilledItemCount: 0,
        readyForPickupItemCount: 0,
        pickedUpItemCount: 0,
        openItemCount: 1,
      },
      recipients: [
        {
          id: 'recipient-1',
          campaignId: 'campaign-1',
          recipientGroupId: 'group-1',
          recipientKind: 'CHILD',
          programType: 'CHILD_FAMILY',
          privacyLevel: 'FULL_NAME',
          displayLabel: 'Ava Johnson',
          programRecipientNumber: null,
          programRecipientId: null,
          firstName: 'Ava',
          lastName: 'Johnson',
          birthYear: null,
          age: 8,
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
            id: 'group-1',
            groupName: 'Johnson Household',
            groupType: 'HOUSEHOLD',
            organizationType: null,
            status: 'ACTIVE',
          },
          wishlist: null,
          workflowSummary: {
            itemCount: 1,
            sponsoredItemCount: 0,
            fulfilledItemCount: 0,
            readyForPickupItemCount: 0,
            pickedUpItemCount: 0,
            openItemCount: 1,
          },
          createdAt: null,
          updatedAt: null,
        },
      ],
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'group-2',
      campaignId: 'campaign-1',
      groupType: 'ORGANIZATION',
      groupName: 'Maple Grove West Wing',
      organizationType: 'SENIOR_PROGRAM',
      programAbbreviation: 'MGWW',
      intakeSource: 'Facility',
      externalReference: null,
      notes: null,
      status: 'ACTIVE',
      addressLine1: null,
      addressLine2: null,
      city: 'Dallas',
      state: 'TX',
      postalCode: '75001',
      primaryContact: null,
      contacts: [],
      authorizedPickupContacts: [],
      recipientCount: 1,
      workflowSummary: {
        itemCount: 0,
        sponsoredItemCount: 0,
        fulfilledItemCount: 0,
        readyForPickupItemCount: 0,
        pickedUpItemCount: 0,
        openItemCount: 0,
      },
      recipients: [
        {
          id: 'recipient-2',
          campaignId: 'campaign-1',
          recipientGroupId: 'group-2',
          recipientKind: 'ADULT',
          programType: 'ORGANIZATION_ADULT',
          privacyLevel: 'FULL_NAME',
          displayLabel: 'Mary Smith',
          programRecipientNumber: 1,
          programRecipientId: 'MGWW-001',
          firstName: 'Mary',
          lastName: 'Smith',
          birthYear: null,
          age: 84,
          gender: 'F',
          addressLine1: '400 Elm St',
          addressLine2: null,
          city: 'Dallas',
          state: 'TX',
          postalCode: '75001',
          directEmail: null,
          directPhone: null,
          facilityRoom: '214B',
          subgroupLabel: null,
          mobilityNotes: null,
          notes: null,
          status: 'ACTIVE',
          group: {
            id: 'group-2',
            groupName: 'Maple Grove West Wing',
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
        },
      ],
      createdAt: null,
      updatedAt: null,
    },
  ],
  recipients: [
    {
      id: 'recipient-1',
      campaignId: 'campaign-1',
      recipientGroupId: 'group-1',
      recipientKind: 'CHILD',
      programType: 'CHILD_FAMILY',
      privacyLevel: 'FULL_NAME',
      displayLabel: 'Ava Johnson',
      programRecipientNumber: null,
      programRecipientId: null,
      firstName: 'Ava',
      lastName: 'Johnson',
      birthYear: null,
      age: 8,
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
        id: 'group-1',
        groupName: 'Johnson Household',
        groupType: 'HOUSEHOLD',
        organizationType: null,
        status: 'ACTIVE',
      },
      wishlist: {
        id: 'wishlist-1',
        campaignId: 'campaign-1',
        recipientId: 'recipient-1',
        wishlistStatus: 'READY',
        intakeMethod: 'FORM',
        submittedAt: null,
        intakeCompletedByContactId: null,
        intakeCompletedByContact: null,
        notes: null,
        items: [
          {
            id: 'item-1',
            wishlistId: 'wishlist-1',
            category: 'Toys',
            itemType: 'GIFT',
            description: 'Art kit',
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
              labelCode: 'wishlist-1-item-1',
              labelVersion: 1,
              labelLastPrintedAt: null,
              labelPrintCount: 0,
            },
            createdAt: null,
            updatedAt: null,
          },
        ],
        createdAt: null,
        updatedAt: null,
      },
      workflowSummary: {
        itemCount: 1,
        sponsoredItemCount: 0,
        fulfilledItemCount: 0,
        readyForPickupItemCount: 0,
        pickedUpItemCount: 0,
        openItemCount: 1,
      },
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'recipient-2',
      campaignId: 'campaign-1',
      recipientGroupId: 'group-2',
      recipientKind: 'ADULT',
      programType: 'ORGANIZATION_ADULT',
      privacyLevel: 'FULL_NAME',
      displayLabel: 'Mary Smith',
      programRecipientNumber: 1,
      programRecipientId: 'MGWW-001',
      firstName: 'Mary',
      lastName: 'Smith',
      birthYear: null,
      age: 84,
      gender: 'F',
      addressLine1: '400 Elm St',
      addressLine2: null,
      city: 'Dallas',
      state: 'TX',
      postalCode: '75001',
      directEmail: null,
      directPhone: null,
      facilityRoom: '214B',
      subgroupLabel: null,
      mobilityNotes: null,
      notes: null,
      status: 'ACTIVE',
      group: {
        id: 'group-2',
        groupName: 'Maple Grove West Wing',
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
    },
  ],
};

const access = {
  campaignId: 'campaign-1',
  globalAppRole: 'APP_ADMIN',
  roleKeys: ['CAMPAIGN_MANAGER'],
  capabilities: ['campaign.recipients.view', 'campaign.recipients.edit', 'campaign.admin'],
};

describe('CampaignPeopleWorkspace', () => {
  it('renders summary cards and filters group rows by search', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampaignPeopleWorkspace
          campaignName="Blessing Tree 2026"
          access={access}
          workspace={workspaceFixture}
          isLoading={false}
          isSaving={false}
          error={null}
          saveMessage={null}
          onSaveGroup={vi.fn()}
          onSaveContact={vi.fn()}
          onDeleteContact={vi.fn()}
          onSaveRecipient={vi.fn()}
          onSaveWishlist={vi.fn()}
          onSaveWishlistItem={vi.fn()}
          onDeleteWishlistItem={vi.fn()}
          onSearchAddresses={vi.fn().mockResolvedValue([])}
          onClearSaveMessage={vi.fn()}
          onClearError={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Open Items')).toBeInTheDocument();
    expect(screen.getAllByText('Johnson Household').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maple Grove West Wing').length).toBeGreaterThan(0);

    await user.type(screen.getByPlaceholderText('Search group name or contact'), 'Johnson');

    const groupTable = screen.getAllByRole('table')[0];
    expect(within(groupTable).getByText('Johnson Household')).toBeInTheDocument();
    expect(within(groupTable).queryByText('Maple Grove West Wing')).not.toBeInTheDocument();
  });

  it('shows compact group member subrows and wishlist gift rows in the directory', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampaignPeopleWorkspace
          campaignName="Blessing Tree 2026"
          access={access}
          workspace={workspaceFixture}
          isLoading={false}
          isSaving={false}
          error={null}
          saveMessage={null}
          onSaveGroup={vi.fn()}
          onSaveContact={vi.fn()}
          onDeleteContact={vi.fn()}
          onSaveRecipient={vi.fn()}
          onSaveWishlist={vi.fn()}
          onSaveWishlistItem={vi.fn()}
          onDeleteWishlistItem={vi.fn()}
          onSearchAddresses={vi.fn().mockResolvedValue([])}
          onClearSaveMessage={vi.fn()}
          onClearError={vi.fn()}
        />
      </MemoryRouter>
    );

    const [groupTable, peopleTable] = screen.getAllByRole('table');

    expect(within(groupTable).queryByText('Ava Johnson')).not.toBeInTheDocument();
    expect(within(peopleTable).queryByText('Art kit')).not.toBeInTheDocument();

    await user.click(within(groupTable).getByRole('button', { name: 'Expand Johnson Household' }));
    await user.click(within(groupTable).getByRole('button', { name: 'Expand Maple Grove West Wing' }));
    await user.click(within(peopleTable).getByRole('button', { name: 'Expand Ava Johnson' }));

    expect(within(groupTable).getByText('Ava Johnson')).toBeInTheDocument();
    expect(within(groupTable).getByText('Mary Smith')).toBeInTheDocument();
    expect(within(groupTable).getByText('Age 8')).toBeInTheDocument();
    expect(within(groupTable).getByText('MGWW-001')).toBeInTheDocument();
    expect(within(peopleTable).getByText('MGWW-001')).toBeInTheDocument();
    expect(within(peopleTable).getByText('Art kit')).toBeInTheDocument();
    expect(within(peopleTable).getByText('Open')).toBeInTheDocument();
  });

  it('opens the person drawer when a recipient row is selected', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampaignPeopleWorkspace
          campaignName="Blessing Tree 2026"
          access={access}
          workspace={workspaceFixture}
          isLoading={false}
          isSaving={false}
          error={null}
          saveMessage={null}
          onSaveGroup={vi.fn()}
          onSaveContact={vi.fn()}
          onDeleteContact={vi.fn()}
          onSaveRecipient={vi.fn()}
          onSaveWishlist={vi.fn()}
          onSaveWishlistItem={vi.fn()}
          onDeleteWishlistItem={vi.fn()}
          onSearchAddresses={vi.fn().mockResolvedValue([])}
          onClearSaveMessage={vi.fn()}
          onClearError={vi.fn()}
        />
      </MemoryRouter>
    );

    const peopleTable = screen.getAllByRole('table')[1];

    await user.click(within(peopleTable).getByRole('button', { name: /Ava Johnson.*Gender F/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ava Johnson')).toBeInTheDocument();
    expect(screen.getByText(/Authorized pickup contacts:/)).toBeInTheDocument();
    expect(screen.getByText(/Label wishlist-1-item-1/)).toBeInTheDocument();
  });
});
