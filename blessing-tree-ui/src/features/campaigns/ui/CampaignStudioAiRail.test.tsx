import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import type {
  CampaignMilestone,
  CampaignReadiness,
  CampaignScheduleItem,
  CommunicationTemplate,
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

const milestones: CampaignMilestone[] = [
  {
    id: 'milestone-1',
    campaignId: 'campaign-123',
    milestoneKey: 'registration_open',
    label: 'Registration Opens',
    occursOn: '2026-11-15',
    notes: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
  },
];

const templates: CommunicationTemplate[] = [
  {
    id: 'template-1',
    templateKey: 'volunteer_reminder',
    name: 'Volunteer Reminder',
    audience: 'VOLUNTEER',
    channel: 'EMAIL',
    subjectTemplate: 'Reminder',
    bodyTemplate: 'Please join us.',
    isActive: true,
    createdByUserId: null,
    createdAt: null,
    updatedAt: null,
  },
];

const scheduleItems: CampaignScheduleItem[] = [];

describe('CampaignStudioAiRail', () => {
  it('shows schedule-specific prompt starters and signals', () => {
    render(
      <CampaignStudioAiRail
        open
        onClose={vi.fn()}
        campaign={campaign}
        selectedSection="schedule"
        readiness={readiness}
        scheduleItems={scheduleItems}
        templates={templates}
        milestones={milestones}
        isSaving={false}
        onCreateScheduleEvent={vi.fn().mockResolvedValue(true)}
        onCreateCommunicationSchedule={vi.fn().mockResolvedValue(true)}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
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
    expect(screen.getByRole('button', { name: /draft calendar change/i })).toBeEnabled();
  });

  it('drafts and applies a calendar event from a prompt', async () => {
    const user = userEvent.setup();
    const onCreateScheduleEvent = vi.fn().mockResolvedValue(true);

    render(
      <CampaignStudioAiRail
        open
        onClose={vi.fn()}
        campaign={campaign}
        selectedSection="schedule"
        readiness={readiness}
        scheduleItems={scheduleItems}
        templates={templates}
        milestones={milestones}
        isSaving={false}
        onCreateScheduleEvent={onCreateScheduleEvent}
        onCreateCommunicationSchedule={vi.fn().mockResolvedValue(true)}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.type(
      screen.getByLabelText(/campaign prompt/i),
      'Add volunteer orientation on 2026-11-03 at 6pm'
    );
    await user.click(screen.getByRole('button', { name: /draft calendar change/i }));

    expect(
      screen.getByText(/volunteer orientation on 2026-11-03/i, {
        selector: '.fw-semibold.small.mb-1',
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /apply draft/i }));

    expect(onCreateScheduleEvent).toHaveBeenCalledWith({
      title: 'Volunteer Orientation',
      eventType: 'VOLUNTEER',
      startAt: '2026-11-03T18:00',
      endAt: null,
      allDay: false,
      notes: 'Add volunteer orientation on 2026-11-03 at 6pm',
    });
  });

  it('uses a compact draft-type selector with a shared description area', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioAiRail
        open
        onClose={vi.fn()}
        campaign={campaign}
        selectedSection="schedule"
        readiness={readiness}
        scheduleItems={scheduleItems}
        templates={templates}
        milestones={milestones}
        isSaving={false}
        onCreateScheduleEvent={vi.fn().mockResolvedValue(true)}
        onCreateCommunicationSchedule={vi.fn().mockResolvedValue(true)}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.getByText(/volunteer days, sorting blocks, pickup staffing/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^communication$/i }));

    expect(
      screen.getByText(/emails and reminders using one of the campaign templates/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^communication$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
