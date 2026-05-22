import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignPeopleGroupDrawer } from '@/features/campaigns/ui/CampaignPeopleGroupDrawer';

describe('CampaignPeopleGroupDrawer', () => {
  it('uses family-specific labels for household intake', () => {
    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        initialGroupType="HOUSEHOLD"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Family' })).toBeInTheDocument();
    expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
  });

  it('uses facility-specific labels and can apply an address suggestion', async () => {
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
        initialGroupType="ADULT_PROGRAM"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Adult Program' })).toBeInTheDocument();
    expect(screen.getByLabelText('Program Name')).toBeInTheDocument();

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

  it('uses adult-program-specific labels for program intake', () => {
    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={null}
        initialGroupType="ADULT_PROGRAM"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onSearchAddresses={vi.fn().mockResolvedValue([])}
        onAddRecipientToGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Adult Program' })).toBeInTheDocument();
    expect(screen.getByLabelText('Program Name')).toBeInTheDocument();
  });

  it('does not search just by opening an existing facility record with an address', async () => {
    const onSearchAddresses = vi.fn().mockResolvedValue([]);

    render(
      <CampaignPeopleGroupDrawer
        isOpen
        isSaving={false}
        canEdit
        group={{
          id: 'group-1',
          campaignId: 'campaign-1',
          groupType: 'ADULT_PROGRAM',
          groupName: 'Maple Grove',
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
        }}
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
    });

    expect(onSearchAddresses).not.toHaveBeenCalled();
  });
});
