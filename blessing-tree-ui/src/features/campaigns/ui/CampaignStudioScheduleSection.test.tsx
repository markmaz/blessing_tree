import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioScheduleSection } from '@/features/campaigns/ui/CampaignStudioScheduleSection';
import type {
  CampaignMilestone,
  CampaignMilestoneDefinition,
  CampaignScheduleItem,
  CommunicationSchedule,
  CommunicationTemplate,
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
    startAt: '2026-11-15T00:00:00',
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
    occursOn: '2026-11-15',
    notes: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
  },
];

const milestoneDefinitions: CampaignMilestoneDefinition[] = [
  {
    id: 'definition-1',
    milestoneKey: 'registration_open',
    label: 'Registration Opens',
    description: null,
    featureArea: 'GENERAL',
    defaultSortOrder: 1,
    isActive: true,
    isSystem: true,
    createdAt: null,
    updatedAt: null,
  },
];

const templates: CommunicationTemplate[] = [
  {
    id: 'template-1',
    campaignId: 'campaign-123',
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

const schedules: CommunicationSchedule[] = [];

describe('CampaignStudioScheduleSection', () => {
  it('opens a create modal from a calendar day and creates a manual event', async () => {
    const user = userEvent.setup();
    const onCreateEvent = vi.fn().mockResolvedValue(true);

    render(
      <CampaignStudioScheduleSection
        access={managerAccess}
        items={scheduleItems}
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={onCreateEvent}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onCreateSchedule={vi.fn().mockResolvedValue(true)}
        onUpdateSchedule={vi.fn().mockResolvedValue(true)}
        onDeleteSchedule={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(screen.getByLabelText(/add a calendar item on 2026-11-02/i));
    expect(
      screen.getByRole('heading', { name: /add calendar event/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^title$/i), 'Pickup Weekend');
    await user.selectOptions(screen.getByLabelText(/event type/i), 'PICKUP');
    await user.clear(screen.getByLabelText(/start date/i));
    await user.type(screen.getByLabelText(/start date/i), '2026-12-19');
    await user.clear(screen.getByLabelText(/end date/i));
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

  it('opens milestone details from a calendar item', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioScheduleSection
        access={managerAccess}
        items={scheduleItems}
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={vi.fn().mockResolvedValue(true)}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onCreateSchedule={vi.fn().mockResolvedValue(true)}
        onUpdateSchedule={vi.fn().mockResolvedValue(true)}
        onDeleteSchedule={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(screen.getByRole('button', { name: /registration opens, nov 15, 2026/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /edit milestone/i })).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('Registration Opens')).toBeInTheDocument();
  });

  it('shows read-only schedule messaging without admin capability', () => {
    render(
      <CampaignStudioScheduleSection
        access={viewerAccess}
        items={scheduleItems}
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={vi.fn().mockResolvedValue(true)}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={vi.fn().mockResolvedValue(true)}
        onCreateSchedule={vi.fn().mockResolvedValue(true)}
        onUpdateSchedule={vi.fn().mockResolvedValue(true)}
        onDeleteSchedule={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.getByText(/read-only calendar/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/add a calendar item on 2026-11-02/i)
    ).not.toBeInTheDocument();
  });

  it('uses custom inline confirmation before deleting an event', async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn().mockResolvedValue(true);

    render(
      <CampaignStudioScheduleSection
        access={managerAccess}
        items={scheduleItems}
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
        isSaving={false}
        onSaveMilestones={vi.fn().mockResolvedValue(true)}
        onCreateEvent={vi.fn().mockResolvedValue(true)}
        onUpdateEvent={vi.fn().mockResolvedValue(true)}
        onDeleteEvent={onDeleteEvent}
        onCreateSchedule={vi.fn().mockResolvedValue(true)}
        onUpdateSchedule={vi.fn().mockResolvedValue(true)}
        onDeleteSchedule={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /volunteer orientation, nov 1, 2026, 9:00 am - 11:00 am/i })
    );

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete event$/i }));
    expect(
      within(dialog).getByText(/delete "volunteer orientation" from the calendar\?/i)
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^delete event$/i }));
    expect(onDeleteEvent).toHaveBeenCalledWith('manual-event-1');
  });
});
