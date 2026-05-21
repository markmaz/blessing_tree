import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from '@/pages/AdminPage';

const mockUseAuth = vi.fn();

vi.mock('@/features/auth/model/authContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AdminPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('shows admin child navigation for app admins', () => {
    mockUseAuth.mockReturnValue({ role: 'ADMIN' });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />}>
            <Route path="users" element={<div>User Management Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llm configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /health check/i })).toBeInTheDocument();
    expect(screen.getByText('User Management Child')).toBeInTheDocument();
  });

  it('blocks non-admin users', () => {
    mockUseAuth.mockReturnValue({ role: 'COORDINATOR' });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />}>
            <Route path="users" element={<div>User Management Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
    expect(screen.queryByText('User Management Child')).not.toBeInTheDocument();
  });
});
