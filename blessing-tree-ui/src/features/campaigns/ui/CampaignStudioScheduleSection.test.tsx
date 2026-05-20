import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioScheduleSection } from '@/features/campaigns/ui/CampaignStudioScheduleSection';
import type {
  CampaignMilestone,
  CampaignScheduleItem,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';

const managerAccess: CampaignAccess = {
  campaignId: 'campaign-123',
  globalAppRole: 'APP_USER',
  roleKeys: ['CAMPAIGN_MANAGER'],
  capabilities: ['campaign.view', 'campaign.admin'],
};

const viewerAccess: CampaignAccess = {
  ...managerAccess,
  capabilities: ['campaign.view'],
};

const scheduleItems: CampaignScheduleItem[] = [
  {
    id: 'manual-event-1',
    title: 'Volunteer Orientation',
    eventType: 'VOLUNTEER',
    sourceType: 'manual',
    sourceId: null,
    startAt: '2026-11-01T09:00:00',
    endAt: '2026-11-01T11:00:00',
    allDay: false,
    notes: 'Kick off the volunteer season.',
    isEditable: true,
  },
  {
    id: 'milestone-1',
    title: 'Registration Opens',
    eventType: 'MILESTONE',
    sourceType: 'milestone',
    sourceId: 'milestone-source-1',
    startAt: '2026-10-15T00:00:00',
    endAt: null,
    allDay: true,
    notes: null,
    isEditable: false,
  },
];

const milestones: CampaignMilestone[] = [
  {
    id: 'milestone-source-1',
    campaignId: 'campaign-123',
    milestoneKey: 'registration_open',
    label: 'Registration Opens',
    occursOn: '2026-10-15',
    notes: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
  },
];

describe('CampaignStudioScheduleSection', () => {
  it('switches between timeline, calendar, and milestone views', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioScheduleSection
        access={managerAccess}
        items={scheduleItems}
        milestones={milestones}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={vi.fn().mockResolvedValue(true)}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onOpenCommunications={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /timeline/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /calendar/i }));
    expect(screen.getByRole('heading', { name: /calendar/i })).toBeInTheDocument();

    await user.click(
      screen.getByRole('tab', { name: /MilestonesStructured editing/i })
    );
    expect(screen.getByRole('heading', { name: /^milestones$/i })).toBeInTheDocument();
  });

  it('creates a manual schedule event', async () => {
    const user = userEvent.setup();
    const onCreateEvent = vi.fn().mockResolvedValue(true);

    render(
      <CampaignStudioScheduleSection
        access={managerAccess}
        items={scheduleItems}
        milestones={milestones}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={onCreateEvent}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onOpenCommunications={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/^title$/i), 'Pickup Weekend');
    await user.selectOptions(screen.getByLabelText(/event type/i), 'PICKUP');
    await user.type(screen.getByLabelText(/start date/i), '2026-12-19');
    await user.type(screen.getByLabelText(/end date/i), '2026-12-20');
    await user.type(screen.getByLabelText(/notes/i), 'Family pickup starts here.');
    await user.click(screen.getByRole('button', { name: /add event/i }));

    expect(onCreateEvent).toHaveBeenCalledWith({
      title: 'Pickup Weekend',
      eventType: 'PICKUP',
      startAt: '2026-12-19T00:00',
      endAt: '2026-12-20T00:00',
      allDay: true,
      notes: 'Family pickup starts here.',
    });
  });

  it('shows read-only schedule messaging without admin capability', () => {
    render(
      <CampaignStudioScheduleSection
        access={viewerAccess}
        items={scheduleItems}
        milestones={milestones}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={vi.fn().mockResolvedValue(true)}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onOpenCommunications={vi.fn()}
      />
    );

    expect(
      screen.getByText(/read-only schedule access/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add event/i })
    ).not.toBeInTheDocument();
  });
});
