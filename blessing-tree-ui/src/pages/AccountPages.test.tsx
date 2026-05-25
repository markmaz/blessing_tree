import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAccountProfile,
  fetchAccountSettings,
  updateAccountProfile,
  updateAccountSettings,
} from '@/features/account/api/accountApi';
import { AccountProfilePage } from '@/pages/AccountProfilePage';
import { AccountSettingsPage } from '@/pages/AccountSettingsPage';

vi.mock('@/features/account/api/accountApi', () => ({
  fetchAccountProfile: vi.fn(),
  fetchAccountSettings: vi.fn(),
  updateAccountProfile: vi.fn(),
  updateAccountSettings: vi.fn(),
}));

describe('Account pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAccountProfile).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Current User',
      role: 'COORDINATOR',
      isActive: true,
      lastLoginAt: null,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });
    vi.mocked(updateAccountProfile).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Updated User',
      role: 'COORDINATOR',
      isActive: true,
      lastLoginAt: null,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });
    vi.mocked(fetchAccountSettings).mockResolvedValue({
      timezone: 'America/Chicago',
      dateFormat: 'MM_DD_YYYY',
      defaultLandingPage: 'DASHBOARD',
      emailNotificationsEnabled: true,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });
    vi.mocked(updateAccountSettings).mockImplementation(async (input) => input);
  });

  it('loads and updates profile display name', async () => {
    const user = userEvent.setup();
    render(<AccountProfilePage />);

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, 'Updated User');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(updateAccountProfile).toHaveBeenCalledWith({ displayName: 'Updated User' });
    });
  });

  it('loads and updates account settings', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsPage />);

    await screen.findByLabelText(/timezone/i);
    await user.selectOptions(screen.getByLabelText(/date format/i), 'YYYY_MM_DD');
    await user.selectOptions(screen.getByLabelText(/default landing page/i), 'CAMPAIGNS');
    await user.click(screen.getByLabelText(/email notifications enabled/i));
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(updateAccountSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFormat: 'YYYY_MM_DD',
          defaultLandingPage: 'CAMPAIGNS',
          emailNotificationsEnabled: false,
        })
      );
    });
  });
});
