import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampaignStudioOverview } from '@/features/campaigns/ui/CampaignStudioOverview';
import type { CampaignStudioData } from '@/features/campaigns/model/campaignStudioTypes';

const studio: CampaignStudioData = {
  campaign: {
    id: 'campaign-1',
    name: 'Blessing Tree 2026',
    description: 'Holiday planning campaign',
    seasonTheme: 'Grace & Renewal',
    year: 2026,
    status: 'ACTIVE',
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    createdAt: null,
    updatedAt: null,
  },
  access: {
    campaignId: 'campaign-1',
    globalAppRole: 'APP_ADMIN',
    roleKeys: ['CAMPAIGN_MANAGER'],
    capabilities: ['campaign.view'],
  },
  summary: {
    campaignId: 'campaign-1',
    counts: {
      recipientGroups: 1,
      recipients: 5,
      wishlists: 3,
      wishlistItems: 12,
      donations: 1,
      sponsorships: 2,
      pickups: 0,
      sponsorshipItems: 2,
      fulfillments: 1,
    },
  },
  team: {
    assignments: [],
    counts: {
      assignmentCount: 1,
      activeAssignmentCount: 1,
      memberCount: 2,
      managerCount: 1,
      roleCounts: {
        CAMPAIGN_MANAGER: 1,
      },
    },
  },
  communications: {
    audienceCatalog: [
      {
        key: 'VOLUNTEER',
        label: 'Volunteers',
        description: 'Campaign roster members marked as volunteers.',
      },
    ],
    templates: [
      {
        id: 'template-1',
        campaignId: 'campaign-1',
        templateKey: 'volunteer_reminder',
        name: 'Volunteer Reminder',
        audience: 'VOLUNTEER',
        channel: 'EMAIL',
        subjectTemplate: 'Reminder',
        bodyTemplate: 'Body',
        isActive: true,
        createdByUserId: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    schedules: [],
  },
  schedule: {
    items: [],
  },
  milestones: [],
  readiness: {
    campaignId: 'campaign-1',
    status: 'READY',
    overallStatus: 'READY',
    phaseStatus: {
      draft: 'READY',
      activate: 'READY',
      operations: 'READY',
      close: 'READY',
    },
    items: [],
    groups: {
      blockers: [],
      launch_checks: [],
      planning_gaps: [],
      operational_health: [],
    },
    counts: {
      errors: 0,
      warnings: 0,
      infos: 0,
    },
    categoryCounts: {
      blockers: 0,
      launch_checks: 0,
      planning_gaps: 0,
      operational_health: 0,
    },
  },
};

describe('CampaignStudioOverview', () => {
  it('opens the communications workspace when a template is clicked', async () => {
    const user = userEvent.setup();
    const onOpenCommunication = vi.fn();

    render(
      <MemoryRouter>
        <CampaignStudioOverview
          studio={studio}
          onEditCampaign={vi.fn()}
          onOpenCommunication={onOpenCommunication}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /volunteer reminder/i }));
    expect(onOpenCommunication).toHaveBeenCalledWith('template-1');
  });
});
