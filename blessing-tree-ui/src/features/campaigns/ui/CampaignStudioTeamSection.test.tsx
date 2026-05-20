import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCampaignDirectoryUsers } from '@/features/campaigns/api/campaignStudioTeamApi';
import { CampaignStudioTeamSection } from '@/features/campaigns/ui/CampaignStudioTeamSection';
import type {
  CampaignDirectoryUser,
  CampaignTeamSnapshot,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';

vi.mock('@/features/campaigns/api/campaignStudioTeamApi', () => ({
  listCampaignDirectoryUsers: vi.fn(),
}));

const mockedListCampaignDirectoryUsers = vi.mocked(listCampaignDirectoryUsers);

const baseAccess: CampaignAccess = {
  campaignId: 'campaign-123',
  globalAppRole: 'APP_USER',
  roleKeys: ['CAMPAIGN_MANAGER'],
  capabilities: ['campaign.view', 'campaign.admin'],
};

const baseTeam: CampaignTeamSnapshot = {
  assignments: [
    {
      id: 'assignment-1',
      campaignId: 'campaign-123',
      userId: 'user-1',
      roleKey: 'CAMPAIGN_MANAGER',
      isActive: true,
      user: {
        id: 'user-1',
        email: 'manager@blessingtree.test',
        displayName: 'Manager User',
        appRole: 'ADMIN',
        isActive: true,
      },
      createdAt: null,
      updatedAt: null,
    },
  ],
  counts: {
    assignmentCount: 1,
    activeAssignmentCount: 1,
    memberCount: 1,
    managerCount: 1,
    roleCounts: {
      CAMPAIGN_MANAGER: 1,
    },
  },
};

const directoryUser: CampaignDirectoryUser = {
  id: 'user-2',
  email: 'volunteer@blessingtree.test',
  displayName: 'Volunteer User',
  appRole: 'VOLUNTEER',
  isActive: true,
  assignedRoleKeys: [],
  inactiveRoleKeys: [],
};

describe('CampaignStudioTeamSection', () => {
  beforeEach(() => {
    mockedListCampaignDirectoryUsers.mockReset();
  });

  it('shows read-only messaging without campaign admin capability', () => {
    render(
      <CampaignStudioTeamSection
        campaignId="campaign-123"
        access={{ ...baseAccess, capabilities: ['campaign.view'] }}
        team={baseTeam}
        isSaving={false}
        onAddAssignment={vi.fn()}
      />
    );

    expect(
      screen.getByText(/team assignment changes require the/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /search directory/i })
    ).not.toBeInTheDocument();
  });

  it('searches the directory and creates a campaign assignment', async () => {
    const user = userEvent.setup();
    const onAddAssignment = vi.fn().mockResolvedValue(true);

    mockedListCampaignDirectoryUsers
      .mockResolvedValueOnce([directoryUser])
      .mockResolvedValueOnce([
        {
          ...directoryUser,
          assignedRoleKeys: ['GIFT_CHECKIN'],
        },
      ]);

    render(
      <CampaignStudioTeamSection
        campaignId="campaign-123"
        access={baseAccess}
        team={baseTeam}
        isSaving={false}
        onAddAssignment={onAddAssignment}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/search active users/i),
      'volunteer'
    );
    await user.selectOptions(
      screen.getByLabelText(/role to assign/i),
      'GIFT_CHECKIN'
    );
    await user.click(screen.getByRole('button', { name: /search directory/i }));

    expect(mockedListCampaignDirectoryUsers).toHaveBeenCalledWith(
      'campaign-123',
      'volunteer',
      8
    );

    expect(await screen.findByText('Volunteer User')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /add as gift check-in/i })
    );

    expect(onAddAssignment).toHaveBeenCalledWith({
      userId: 'user-2',
      roleKey: 'GIFT_CHECKIN',
      isActive: true,
    });

    await waitFor(() => {
      expect(mockedListCampaignDirectoryUsers).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole('button', { name: /already assigned/i })
    ).toBeDisabled();
  });
});
