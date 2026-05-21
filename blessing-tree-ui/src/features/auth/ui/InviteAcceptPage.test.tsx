import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptPage } from '@/features/auth/ui/InviteAcceptPage';
import { acceptInvite, validateInviteToken } from '@/shared/api/authApi';

vi.mock('@/shared/api/authApi', () => ({
  acceptInvite: vi.fn(),
  validateInviteToken: vi.fn(),
}));

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateInviteToken).mockResolvedValue({
      invitationId: 'invite-1',
      userId: 'user-1',
      email: 'invitee@example.com',
      displayName: 'Invited User',
      expiresAt: '2026-05-28T00:00:00Z',
    });
    vi.mocked(acceptInvite).mockResolvedValue();
  });

  it('validates the invite token and submits the accept flow', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/auth/register?token=invite-token-1']}>
        <InviteAcceptPage />
      </MemoryRouter>
    );

    expect(validateInviteToken).toHaveBeenCalledWith('invite-token-1');
    expect(await screen.findByDisplayValue('Invited User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('invitee@example.com')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/password/i), 'BlessingTree12345!');
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with yahoo/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /set password & continue/i }));

    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledWith('invite-token-1', {
        displayName: 'Invited User',
        email: 'invitee@example.com',
        password: 'BlessingTree12345!',
      });
    });
  });

  it('shows a clear message when invite-page oauth is selected before phase 3', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/auth/register?token=invite-token-1']}>
        <InviteAcceptPage />
      </MemoryRouter>
    );

    await screen.findByDisplayValue('Invited User');
    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(
      screen.getByText(/invite-based google onboarding is not enabled yet/i)
    ).toBeInTheDocument();
  });
});
