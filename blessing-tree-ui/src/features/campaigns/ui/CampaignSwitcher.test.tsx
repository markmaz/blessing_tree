import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignSwitcher } from '@/features/campaigns/ui/CampaignSwitcher';

const mockNavigate = vi.fn();
const mockUseCampaigns = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/campaigns/model/campaignContext', () => ({
  useCampaigns: () => mockUseCampaigns(),
}));

describe('CampaignSwitcher', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseCampaigns.mockReset();
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        { id: 'campaign-1', name: 'Blessing Tree', year: 2026 },
        { id: 'campaign-2', name: 'Easter Outreach', year: 2027 },
      ],
      isLoading: false,
      error: null,
      selectedCampaignId: 'campaign-1',
      selectCampaign: vi.fn(),
    });
  });

  it('navigates directly to the chosen campaign when selection changes', async () => {
    const user = userEvent.setup();
    const selectCampaign = vi.fn();
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        { id: 'campaign-1', name: 'Blessing Tree', year: 2026 },
        { id: 'campaign-2', name: 'Easter Outreach', year: 2027 },
      ],
      isLoading: false,
      error: null,
      selectedCampaignId: 'campaign-1',
      selectCampaign,
    });

    render(
      <MemoryRouter>
        <CampaignSwitcher />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /campaign/i }), 'campaign-2');

    expect(selectCampaign).toHaveBeenCalledWith('campaign-2');
    expect(mockNavigate).toHaveBeenCalledWith('/campaigns/campaign-2');
  });
});
