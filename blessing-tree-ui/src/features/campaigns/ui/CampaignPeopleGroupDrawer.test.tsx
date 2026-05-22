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
        initialGroupType="CARE_FACILITY"
        onClose={vi.fn()}
        onSaveGroup={vi.fn()}
        onSaveContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={vi.fn()}
        onSelectRecipient={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Facility' })).toBeInTheDocument();
    expect(screen.getByLabelText('Facility Name')).toBeInTheDocument();

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
});
