import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioTeamListTable } from '@/features/campaigns/ui/CampaignStudioTeamListTable';
import type { CampaignTeamWorkspaceTeam } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

const teams: CampaignTeamWorkspaceTeam[] = [
  {
    id: 'team-1',
    campaignId: 'campaign-1',
    name: 'Warehouse Crew',
    description: 'Handles intake and sorting.',
    isActive: true,
    memberCount: 4,
    roles: [
      {
        id: 'team-role-1',
        teamId: 'team-1',
        name: 'Lead',
        description: 'Coordinates the crew.',
        sortOrder: 1,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'team-role-2',
        teamId: 'team-1',
        name: 'Gift Check-In',
        description: 'Checks gifts into inventory.',
        sortOrder: 2,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      },
    ],
    memberships: [],
    createdAt: null,
    updatedAt: null,
  },
  {
    id: 'team-2',
    campaignId: 'campaign-1',
    name: 'Pickup Weekend',
    description: null,
    isActive: true,
    memberCount: 2,
    roles: [],
    memberships: [],
    createdAt: null,
    updatedAt: null,
  },
];

describe('CampaignStudioTeamListTable', () => {
  it('renders team roles as badges under the team name', () => {
    render(
      <CampaignStudioTeamListTable
        teams={teams}
        selectedTeamId={null}
        onSelectTeam={vi.fn()}
      />
    );

    const warehouseRow = screen.getByRole('button', { name: /warehouse crew/i });
    expect(within(warehouseRow).getByText('Lead')).toBeInTheDocument();
    expect(within(warehouseRow).getByText('Gift Check-In')).toBeInTheDocument();
    expect(within(warehouseRow).queryByText(/4 members/i)).not.toBeInTheDocument();

    const pickupRow = screen.getByRole('button', { name: /pickup weekend/i });
    expect(within(pickupRow).getByText('Member Only')).toBeInTheDocument();
  });
});
