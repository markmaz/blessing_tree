import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAdminAuditEventDetail,
  fetchAdminAuditEvents,
} from '@/features/admin/api/adminApi';
import { AdminActivityLogPage } from '@/pages/AdminActivityLogPage';

vi.mock('@/features/admin/api/adminApi', () => ({
  fetchAdminAuditEvents: vi.fn(),
  fetchAdminAuditEventDetail: vi.fn(),
}));

const listPayload = {
  items: [
    {
      id: 'event-1',
      occurredAt: '2026-05-29T14:00:00Z',
      actor: {
        userId: 'user-1',
        displayName: 'Mark Admin',
        email: 'mark@example.com',
      },
      campaign: {
        id: 'campaign-1',
        name: 'Christmas 2026',
      },
      area: 'sponsors',
      action: 'updated',
      entityType: 'sponsor',
      entityId: 'sponsor-1',
      entityLabel: 'Jane Sponsor',
      summary: 'Updated sponsor phone number.',
      changeCount: 1,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 25,
    total: 1,
  },
  filters: {
    areas: ['sponsors', 'gifts'],
    actions: ['created', 'updated'],
  },
};

const detailPayload = {
  event: {
    ...listPayload.items[0],
    changeSet: [
      {
        field: 'phone',
        label: 'Phone',
        before: '555-1000',
        after: '555-2000',
      },
    ],
    metadata: { source: 'admin-ui' },
    correlationId: 'correlation-1',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    createdAt: '2026-05-29T14:00:01Z',
  },
};

describe('AdminActivityLogPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminAuditEvents).mockReset();
    vi.mocked(fetchAdminAuditEventDetail).mockReset();
    vi.mocked(fetchAdminAuditEvents).mockResolvedValue(listPayload);
    vi.mocked(fetchAdminAuditEventDetail).mockResolvedValue(detailPayload);
  });

  it('renders activity rows and opens the detail drawer from a row click', async () => {
    const user = userEvent.setup();

    render(<AdminActivityLogPage />);

    expect(await screen.findByRole('heading', { name: /activity log/i })).toBeInTheDocument();
    expect(screen.getByText('Updated sponsor phone number.')).toBeInTheDocument();
    expect(screen.getByText('Mark Admin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view activity updated sponsor phone number/i }));

    expect(await screen.findByRole('dialog', { name: /activity details/i })).toBeInTheDocument();
    expect(fetchAdminAuditEventDetail).toHaveBeenCalledWith('event-1');
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('555-1000')).toBeInTheDocument();
    expect(screen.getByText('555-2000')).toBeInTheDocument();
  });

  it('applies filters with backend query values', async () => {
    const user = userEvent.setup();

    render(<AdminActivityLogPage />);

    await screen.findByText('Updated sponsor phone number.');

    await user.type(screen.getByLabelText(/search/i), 'Jane');
    await user.selectOptions(screen.getByLabelText(/area/i), 'sponsors');
    await user.selectOptions(screen.getByLabelText(/action/i), 'updated');
    await user.selectOptions(screen.getByLabelText(/rows/i), '50');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      expect(fetchAdminAuditEvents).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 50,
        search: 'Jane',
        area: 'sponsors',
        action: 'updated',
        dateFrom: undefined,
        dateTo: undefined,
      });
    });
  });
});
