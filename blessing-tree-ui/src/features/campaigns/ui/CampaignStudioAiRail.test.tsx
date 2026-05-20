import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import type {
  CampaignReadiness,
  CampaignScheduleItem,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';

const campaign: Campaign = {
  id: 'campaign-123',
  name: 'Blessing Tree 2026 Demo',
  year: 2026,
  description: 'Demo campaign',
  status: 'ACTIVE',
  startDate: '2026-11-01',
  endDate: '2026-12-20',
  createdAt: null,
  updatedAt: null,
};

const readiness: CampaignReadiness = {
  campaignId: 'campaign-123',
  status: 'NEEDS_ATTENTION',
  items: [
    {
      severity: 'warning',
      code: 'missing_manual_schedule',
      section: 'schedule',
      message: 'Add at least one manual planning event to shape the campaign timeline.',
      details: {},
    },
    {
      severity: 'warning',
      code: 'missing_schedule_messaging',
      section: 'schedule',
      message: 'Add communication timing for the key milestones already on the calendar.',
      details: { missing_keys: ['registration_open'] },
    },
  ],
  counts: {
    errors: 0,
    warnings: 2,
    infos: 0,
  },
};

const scheduleItems: CampaignScheduleItem[] = [];

describe('CampaignStudioAiRail', () => {
  it('shows schedule-specific prompt starters and signals', () => {
    render(
      <CampaignStudioAiRail
        campaign={campaign}
        selectedSection="schedule"
        readiness={readiness}
        scheduleItems={scheduleItems}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /add volunteer orientation, sorting, and pickup planning blocks/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add communication timing for the key milestones/i)
    ).toBeInTheDocument();
  });

  it('falls back to general prompts for non-schedule sections', () => {
    render(
      <CampaignStudioAiRail
        campaign={campaign}
        selectedSection="team"
        readiness={readiness}
        scheduleItems={scheduleItems}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /create a sponsor reminder sequence for this campaign/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/current signals/i)
    ).not.toBeInTheDocument();
  });
});
