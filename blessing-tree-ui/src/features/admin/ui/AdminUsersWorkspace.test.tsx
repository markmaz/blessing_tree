import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersWorkspace } from '@/features/admin/ui/AdminUsersWorkspace';
import {
  createAdminInvite,
  resendAdminInvite,
  updateAdminUserStatus,
} from '@/features/admin/api/adminApi';

vi.mock('@/features/admin/api/adminApi', () => ({
  createAdminInvite: vi.fn(),
  resendAdminInvite: vi.fn(),
  updateAdminUserStatus: vi.fn(),
}));

const roleCatalog = [
  {
    roleKey: 'ADMIN',
    label: 'Administrator',
    description: 'Full application access.',
  },
  {
    roleKey: 'COORDINATOR',
    label: 'Coordinator',
    description: 'Standard coordinating access.',
  },
];

const users = [
  {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice Doe',
    role: 'ADMIN',
    isActive: true,
    lastLoginAt: '2026-05-20T12:00:00Z',
    createdAt: '2026-05-10T12:00:00Z',
    updatedAt: '2026-05-20T12:00:00Z',
  },
  {
    id: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob Smith',
    role: 'COORDINATOR',
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-05-12T12:00:00Z',
    updatedAt: '2026-05-19T12:00:00Z',
  },
];

const invitations = [
  {
    id: 'invite-2',
    userId: 'user-2',
    email: 'bob@example.com',
    status: 'pending',
    expiresAt: '2026-05-30T12:00:00Z',
    acceptedAt: null,
    revokedAt: null,
    createdAt: '2026-05-18T12:00:00Z',
    updatedAt: '2026-05-18T12:00:00Z',
  },
];

describe('AdminUsersWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminInvite).mockResolvedValue({
      invitation: {
        id: 'invite-3',
        userId: 'user-3',
        email: 'carol@example.com',
        status: 'pending',
        expiresAt: '2026-05-30T12:00:00Z',
        acceptedAt: null,
        revokedAt: null,
        createdAt: '2026-05-18T12:00:00Z',
        updatedAt: '2026-05-18T12:00:00Z',
      },
    });
    vi.mocked(resendAdminInvite).mockResolvedValue({
      ...invitations[0],
    });
    vi.mocked(updateAdminUserStatus).mockResolvedValue({
      ...users[1],
      isActive: false,
    });
  });

  it('filters, sorts, and opens the detail drawer', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminUsersWorkspace
        users={users}
        invitations={invitations}
        roleCatalog={roleCatalog}
        onDataChanged={onDataChanged}
      />
    );

    const rowLinks = [
      screen.getByRole('button', { name: 'Alice Doe' }),
      screen.getByRole('button', { name: 'Bob Smith' }),
    ];
    expect(rowLinks[0]).toHaveTextContent('Alice Doe');
    expect(rowLinks[1]).toHaveTextContent('Bob Smith');

    await user.click(screen.getByRole('button', { name: /^name/i }));
    const sortedRowLinks = [
      screen.getAllByRole('button', { name: 'Bob Smith' })[0],
      screen.getAllByRole('button', { name: 'Alice Doe' })[0],
    ];
    expect(sortedRowLinks[0]).toHaveTextContent('Bob Smith');

    await user.clear(screen.getByPlaceholderText(/search users by name/i));
    await user.type(screen.getByPlaceholderText(/search users by name/i), 'bob');
    expect(screen.getByRole('button', { name: 'Bob Smith' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alice Doe' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bob Smith' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/latest invitation status/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/coordinator/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /resend invite/i })).toBeInTheDocument();
  });

  it('supports row action menu resend for invited users', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminUsersWorkspace
        users={users}
        invitations={invitations}
        roleCatalog={roleCatalog}
        onDataChanged={onDataChanged}
      />
    );

    await user.click(screen.getByRole('button', { name: /open actions for bob smith/i }));
    await user.click(screen.getByRole('button', { name: /resend invite/i }));

    await waitFor(() => {
      expect(resendAdminInvite).toHaveBeenCalledWith('invite-2');
      expect(onDataChanged).toHaveBeenCalled();
    });
  });

  it('deactivates a user from the row action menu', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminUsersWorkspace
        users={users}
        invitations={invitations}
        roleCatalog={roleCatalog}
        onDataChanged={onDataChanged}
      />
    );

    await user.click(screen.getByRole('button', { name: /open actions for bob smith/i }));
    await user.click(screen.getByRole('button', { name: /deactivate user/i }));

    await waitFor(() => {
      expect(updateAdminUserStatus).toHaveBeenCalledWith('user-2', false);
      expect(onDataChanged).toHaveBeenCalled();
    });
  });

  it('opens the invite drawer and creates a user invitation', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminUsersWorkspace
        users={users}
        invitations={invitations}
        roleCatalog={roleCatalog}
        onDataChanged={onDataChanged}
      />
    );

    await user.click(screen.getByRole('button', { name: /invite user/i }));
    expect(await screen.findByRole('heading', { name: /invite user/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/display name/i), 'Carol Jones');
    await user.type(screen.getByLabelText(/email/i), 'carol@example.com');
    await user.selectOptions(screen.getByLabelText(/global role/i), 'COORDINATOR');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(createAdminInvite).toHaveBeenCalledWith({
        displayName: 'Carol Jones',
        email: 'carol@example.com',
        role: 'COORDINATOR',
      });
      expect(onDataChanged).toHaveBeenCalled();
    });
  });
});
