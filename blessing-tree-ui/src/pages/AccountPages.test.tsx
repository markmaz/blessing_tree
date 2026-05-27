import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeAccountPassword,
  fetchAccountProfile,
  fetchAccountSettings,
  updateAccountProfile,
  updateAccountSettings,
} from '@/features/account/api/accountApi';
import { AccountProfilePage } from '@/pages/AccountProfilePage';
import { AccountSettingsPage } from '@/pages/AccountSettingsPage';

vi.mock('@/features/account/api/accountApi', () => ({
  changeAccountPassword: vi.fn(),
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
    vi.mocked(changeAccountPassword).mockResolvedValue(undefined);
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

  it('updates profile password and can show typed password values', async () => {
    const user = userEvent.setup();
    render(<AccountProfilePage />);

    const currentPassword = await screen.findByLabelText(/current password/i, { selector: 'input' });
    const newPassword = screen.getByLabelText(/new password/i, { selector: 'input' });
    const confirmPassword = screen.getByLabelText(/confirm password/i, { selector: 'input' });

    await user.type(currentPassword, 'OldPass1');
    await user.type(newPassword, 'NewPass1');
    await user.type(confirmPassword, 'NewPass1');
    await user.click(screen.getByRole('button', { name: /show new password/i }));

    expect(newPassword).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(changeAccountPassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1',
        confirmPassword: 'NewPass1',
      });
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
