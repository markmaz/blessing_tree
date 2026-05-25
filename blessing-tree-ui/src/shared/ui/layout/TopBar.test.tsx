import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from '@/shared/ui/layout/TopBar';

vi.mock('@/features/auth/model/authContext', () => ({
  useAuth: () => ({
    email: 'user@example.com',
    logout: vi.fn(),
    token: 'token',
  }),
}));

vi.mock('@/features/campaigns/ui/CampaignSwitcher', () => ({
  CampaignSwitcher: () => <div />,
}));

describe('TopBar', () => {
  it('links account menu items to profile and settings routes', () => {
    render(
      <MemoryRouter>
        <TopBar pageTitle="Dashboard" onToggleSidebar={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/account/profile');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/account/settings');
  });
});
