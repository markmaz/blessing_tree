import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthCallbackPage } from '@/features/auth/ui/OAuthCallbackPage';

const navigateMock = vi.fn();
const restoreSessionMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/auth/model/authContext', () => ({
  useAuth: () => ({
    restoreSession: restoreSessionMock,
  }),
}));

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    restoreSessionMock.mockReset();
    restoreSessionMock.mockResolvedValue(undefined);
  });

  it('shows invitation-specific completion messaging for invite-scoped oauth', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?flow=invite&provider=google']}>
        <OAuthCallbackPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/completing google account setup/i)).toBeInTheDocument();
    expect(
      screen.getByText(/we’re finishing your invitation and starting your session/i)
    ).toBeInTheDocument();
  });
});
