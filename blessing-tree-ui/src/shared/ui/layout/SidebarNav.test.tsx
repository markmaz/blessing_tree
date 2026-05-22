import { render, screen } from '@testing-library/react';
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
      selectedCampaignId: 'campaign-123',
    });
  });

  it('renders admin child menu items in the left navigation for app admins', () => {
    render(
      <MemoryRouter initialEntries={['/admin/llm']}>
        <SidebarNav isOpen onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /^admin$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llm configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /health check/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /app capabilities/i })).toBeInTheDocument();
  });
});
