import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarNav } from '@/shared/ui/layout/SidebarNav';

const mockUseAuth = vi.fn();
const mockUseAppFeatures = vi.fn();
const mockUseCampaigns = vi.fn();

vi.mock('@/features/auth/model/authContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/features/admin/model/appFeaturesContext', () => ({
  useAppFeatures: () => mockUseAppFeatures(),
}));

vi.mock('@/features/campaigns/model/campaignContext', () => ({
  useCampaigns: () => mockUseCampaigns(),
}));

describe('SidebarNav', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAppFeatures.mockReset();
    mockUseCampaigns.mockReset();
    mockUseAuth.mockReturnValue({ role: 'ADMIN' });
    mockUseAppFeatures.mockReturnValue({
      isFeatureEnabled: () => true,
    });
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        {
          id: 'campaign-123',
          name: 'Blessing Tree 2026',
          year: 2026,
          description: null,
          seasonTheme: 'Grace & Renewal',
          status: 'ACTIVE',
          startDate: '2026-11-01',
          endDate: '2026-12-20',
          createdAt: null,
          updatedAt: null,
          userAccess: {
            campaignId: 'campaign-123',
            globalAppRole: 'APP_ADMIN',
            roleKeys: ['CAMPAIGN_MANAGER'],
            capabilities: [
              'campaign.view',
              'campaign.admin',
              'campaign.recipients.view',
              'campaign.recipients.edit',
              'campaign.sponsors.view',
              'campaign.sponsors.manage',
              'campaign.gifts.search',
              'campaign.gifts.check_in',
              'campaign.gifts.wrap',
              'campaign.gifts.distribute',
              'campaign.gifts.pool.manage',
              'campaign.reports.view',
            ],
          },
        },
      ],
      isLoading: false,
      selectedCampaignId: 'campaign-123',
      selectedCampaign: {
        id: 'campaign-123',
        name: 'Blessing Tree 2026',
        year: 2026,
        description: null,
        seasonTheme: 'Grace & Renewal',
        status: 'ACTIVE',
        startDate: '2026-11-01',
        endDate: '2026-12-20',
        createdAt: null,
        updatedAt: null,
        userAccess: {
          campaignId: 'campaign-123',
          globalAppRole: 'APP_ADMIN',
          roleKeys: ['CAMPAIGN_MANAGER'],
          capabilities: [
            'campaign.view',
            'campaign.admin',
            'campaign.recipients.view',
            'campaign.recipients.edit',
            'campaign.sponsors.view',
            'campaign.sponsors.manage',
            'campaign.gifts.search',
            'campaign.gifts.check_in',
            'campaign.gifts.wrap',
            'campaign.gifts.distribute',
            'campaign.gifts.pool.manage',
            'campaign.reports.view',
          ],
        },
      },
    });
  });

  it('renders admin child menu items in the left navigation for app admins', () => {
    render(
      <MemoryRouter initialEntries={['/admin/llm']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/^admin$/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /campaign operations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llm configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /health check/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /app capabilities/i })).toBeInTheDocument();
  });

  it('renders people child menu items for the selected campaign', () => {
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/people/intake']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/^people$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/intake/i)).toHaveLength(1);
    expect(screen.getByRole('link', { name: /intake/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /directory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute(
      'href',
      '/campaigns/campaign-123/people/reports'
    );
  });

  it('renders a visible icon for the sponsor navigation group', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/sponsors/intake']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /sponsors/i })).toBeInTheDocument();
    expect(container.querySelector('.sidebar-link .bi-award')).toBeInTheDocument();
  });

  it('highlights only the people directory path instead of also highlighting campaigns', () => {
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/people/directory']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /campaigns/i })).not.toHaveClass('active');
    expect(screen.getByRole('button', { name: /people/i })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /directory/i })).toHaveClass('active');
  });

  it('renders the gift tag builder under gifts for campaign managers', () => {
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/gifts/tag-builder']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /gifts/i })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /gift tag builder/i })).toHaveAttribute(
      'href',
      '/campaigns/campaign-123/gifts/tag-builder'
    );
  });

  it('uses the campaign id from the current route when selectedCampaignId is not loaded yet', () => {
    mockUseCampaigns.mockReturnValue({
      selectedCampaignId: null,
      selectedCampaign: null,
    });

    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-xyz/people/intake']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /intake/i })).toHaveAttribute(
      'href',
      '/campaigns/campaign-xyz/people/intake'
    );
    expect(screen.getByRole('link', { name: /directory/i })).toHaveAttribute(
      'href',
      '/campaigns/campaign-xyz/people/directory'
    );
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute(
      'href',
      '/campaigns/campaign-xyz/people/reports'
    );
  });

  it('does not render people child links without a campaign context', () => {
    mockUseCampaigns.mockReturnValue({
      campaigns: [],
      isLoading: false,
      selectedCampaignId: null,
      selectedCampaign: null,
    });

    render(
      <MemoryRouter initialEntries={['/campaigns']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /intake/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /directory/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /reports/i })).not.toBeInTheDocument();
  });

  it('hides campaign areas that are not allowed by the selected campaign access', () => {
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        {
          id: 'campaign-123',
          name: 'Blessing Tree 2026',
          year: 2026,
          description: null,
          seasonTheme: 'Grace & Renewal',
          status: 'ACTIVE',
          startDate: '2026-11-01',
          endDate: '2026-12-20',
          createdAt: null,
          updatedAt: null,
          userAccess: {
            campaignId: 'campaign-123',
            globalAppRole: 'APP_USER',
            roleKeys: ['PEOPLE_MANAGER'],
            capabilities: [
              'campaign.view',
              'campaign.recipients.view',
              'campaign.recipients.edit',
            ],
          },
        },
      ],
      isLoading: false,
      selectedCampaignId: 'campaign-123',
      selectedCampaign: null,
    });

    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/people/intake']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /people/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sponsors/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gifts/i })).not.toBeInTheDocument();
  });

  it('allows grouped navigation sections to collapse and expand', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/admin/llm']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    const adminToggle = screen.getByRole('button', { name: /admin/i });
    expect(adminToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /health check/i })).toBeInTheDocument();

    await user.click(adminToggle);

    expect(adminToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /health check/i })).not.toBeInTheDocument();

    await user.click(adminToggle);

    expect(adminToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /health check/i })).toBeInTheDocument();
  });

  it('opens the season theme modal and shows the returned verse and prayer', async () => {
    const user = userEvent.setup();
    const onOpenSeasonTheme = vi.fn();

    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-123/people/directory']}>
        <SidebarNav isOpen onNavigate={() => {}} onOpenSeasonTheme={onOpenSeasonTheme} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /season theme/i }));

    expect(onOpenSeasonTheme).toHaveBeenCalledTimes(1);
  });
});
