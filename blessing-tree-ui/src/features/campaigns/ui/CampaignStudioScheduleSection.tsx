import { startTransition, useEffect, useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioSchedule.css';
import { getCampaignCalendarIntelligence } from '@/features/campaigns/api/campaignStudioApi';
import { formatScheduleDateRange, sourceLabel } from '@/features/campaigns/model/campaignSchedule';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignCalendarAgendaGroup,
  CampaignCalendarCriticalDate,
  CampaignCalendarIntelligence,
  CampaignCalendarIntelligenceItem,
  CampaignMilestone,
  CampaignMilestoneDefinition,
  CampaignScheduleItem,
  CommunicationAudienceOption,
  CommunicationAudienceRecipientSummary,
  CommunicationSchedule,
  CommunicationTemplate,
  CreateCampaignEventInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
  UpdateCampaignEventInput,
  UpdateCommunicationScheduleInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import {
  CampaignStudioScheduleCalendar,
} from '@/features/campaigns/ui/CampaignStudioScheduleCalendar';
import {
  type CampaignScheduleEditorType,
  CampaignStudioScheduleModal,
} from '@/features/campaigns/ui/CampaignStudioScheduleModal';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioScheduleSectionProps {
  campaignId: string;
  access: CampaignAccess;
  items: CampaignScheduleItem[];
  milestoneDefinitions: CampaignMilestoneDefinition[];
  milestones: CampaignMilestone[];
  schedules: CommunicationSchedule[];
  templates: CommunicationTemplate[];
  audienceCatalog?: CommunicationAudienceOption[];
  audienceRecipientSummaries?: CommunicationAudienceRecipientSummary[];
  isSaving: boolean;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onCreateEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onUpdateEvent: (eventId: string, input: UpdateCampaignEventInput) => Promise<boolean>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onCreateSchedule: (input: CreateCommunicationScheduleInput) => Promise<boolean>;
  onUpdateSchedule: (
    scheduleId: string,
    input: UpdateCommunicationScheduleInput
  ) => Promise<boolean>;
  onDeleteSchedule: (scheduleId: string) => Promise<boolean>;
}

interface ScheduleModalState {
  isOpen: boolean;
  editorType: CampaignScheduleEditorType;
  selectedDate: string | null;
  item: CampaignScheduleItem | null;
  initialMilestoneKey: string | null;
}

const closedModalState: ScheduleModalState = {
  isOpen: false,
  editorType: 'event',
  selectedDate: null,
  item: null,
  initialMilestoneKey: null,
};

export function CampaignStudioScheduleSection({
  campaignId,
  access,
  items,
  milestoneDefinitions,
  milestones,
  schedules,
  templates,
  audienceCatalog = [],
  audienceRecipientSummaries = [],
  isSaving,
  onSaveMilestones,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: CampaignStudioScheduleSectionProps) {
  const [modalState, setModalState] = useState<ScheduleModalState>(closedModalState);
  const [calendarIntelligence, setCalendarIntelligence] = useState<CampaignCalendarIntelligence | null>(null);
  const [calendarIntelligenceError, setCalendarIntelligenceError] = useState<string | null>(null);
  const [isCalendarIntelligenceLoading, setIsCalendarIntelligenceLoading] = useState(false);
  const canAdministerSchedule = canManageCampaign(access);
  const summary = useMemo(
    () => ({
      total: items.length,
      manual: items.filter((item) => item.sourceType === 'manual').length,
      milestones: items.filter((item) => item.sourceType === 'milestone').length,
      communications: items.filter((item) => item.sourceType === 'communication').length,
      next: items.find((item) => item.startAt) ?? null,
    }),
    [items]
  );
  const intelligenceRefreshKey = useMemo(
    () => [
      items.map((item) => `${item.id}:${item.startAt ?? ''}:${item.endAt ?? ''}`).join('|'),
      milestones.map((milestone) => `${milestone.milestoneKey}:${milestone.occursOn ?? ''}`).join('|'),
      schedules.map((schedule) => `${schedule.id}:${schedule.scheduledFor ?? ''}:${schedule.status}`).join('|'),
    ].join('::'),
    [items, milestones, schedules]
  );

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setIsCalendarIntelligenceLoading(true);
      setCalendarIntelligenceError(null);
    });
    getCampaignCalendarIntelligence(campaignId)
      .then((payload) => {
        if (!cancelled) {
          setCalendarIntelligence(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCalendarIntelligenceError(error instanceof Error ? error.message : 'Unable to load calendar overview.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCalendarIntelligenceLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, intelligenceRefreshKey]);

  const openCreateModal = (selectedDate: string) => {
    if (!canAdministerSchedule) {
      return;
    }
    setModalState({
      isOpen: true,
      editorType: 'event',
      selectedDate,
      item: null,
      initialMilestoneKey: null,
    });
  };

  const openItemModal = (item: CampaignScheduleItem) => {
    if (!canAdministerSchedule) {
      return;
    }
    setModalState({
      isOpen: true,
      editorType: sourceToEditorType(item.sourceType),
      selectedDate: item.startAt?.slice(0, 10) ?? null,
      item,
      initialMilestoneKey: null,
    });
  };

  const openIntelligenceItem = (item: CampaignCalendarIntelligenceItem | CampaignCalendarCriticalDate) => {
    if (!canAdministerSchedule) {
      return;
    }
    const matchingItem = findScheduleItemForIntelligenceItem(items, item);
    if (matchingItem) {
      openItemModal(matchingItem);
      return;
    }
    if (item.sourceType === 'milestone_definition' && item.sourceId) {
      setModalState({
        isOpen: true,
        editorType: 'milestone',
        selectedDate: null,
        item: null,
        initialMilestoneKey: item.sourceId,
      });
    }
  };

  const closeModal = () => {
    setModalState(closedModalState);
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Schedule"
        title="Campaign Calendar"
        description="Click a date to add something new. Click any item on the calendar to edit it. Use the month and year selectors to move through the campaign plan."
      >
        <div className="campaign-studio__schedule-header">
          <div>
            <div className="campaign-chip-row mb-2">
              <span className="campaign-chip">{summary.total} items</span>
              <span className="campaign-chip campaign-chip-muted">
                {summary.manual} events
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {summary.milestones} milestones
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {summary.communications} communications
              </span>
            </div>
            <div className="small text-muted">
              {summary.next
                ? `Next up: ${summary.next.title} · ${formatScheduleDateRange(summary.next)}`
                : 'No upcoming schedule items yet.'}
            </div>
          </div>

          <div className="campaign-studio__schedule-summary">
            {summary.next ? (
              <span className="campaign-chip">{sourceLabel(summary.next.sourceType)}</span>
            ) : null}
            <span className="campaign-chip campaign-chip-muted">
              {canAdministerSchedule ? 'Calendar editing enabled' : 'View only'}
            </span>
          </div>
        </div>
      </CampaignStudioSectionCard>

      <CampaignCalendarOverviewPanel
        intelligence={calendarIntelligence}
        isLoading={isCalendarIntelligenceLoading}
        error={calendarIntelligenceError}
        onSelectItem={openIntelligenceItem}
      />

      <CampaignStudioScheduleCalendar
        items={items}
        canManageSchedule={canAdministerSchedule}
        onSelectDate={openCreateModal}
        onSelectItem={openItemModal}
      />

      {!canAdministerSchedule ? (
        <CampaignStudioSectionCard
          eyebrow="Access"
          title="Read-Only Calendar"
          description="Campaign managers and app admins can add or edit items directly on the calendar."
        >
          <div className="campaign-studio__empty-note">
            You currently have read-only schedule access for this campaign.
          </div>
        </CampaignStudioSectionCard>
      ) : null}

      <CampaignStudioScheduleModal
        isOpen={modalState.isOpen}
        editorType={modalState.editorType}
        isEditing={modalState.item !== null}
        item={modalState.item}
        selectedDate={modalState.selectedDate}
        initialMilestoneKey={modalState.initialMilestoneKey}
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
        audienceCatalog={audienceCatalog}
        audienceRecipientSummaries={audienceRecipientSummaries}
        isSaving={isSaving}
        onSelectType={(editorType) =>
          setModalState((currentState) => ({
            ...currentState,
            editorType,
          }))
        }
        onClose={closeModal}
        onCreateEvent={onCreateEvent}
        onUpdateEvent={onUpdateEvent}
        onDeleteEvent={onDeleteEvent}
        onSaveMilestones={onSaveMilestones}
        onCreateSchedule={onCreateSchedule}
        onUpdateSchedule={onUpdateSchedule}
        onDeleteSchedule={onDeleteSchedule}
      />
    </div>
  );
}

function CampaignCalendarOverviewPanel({
  intelligence,
  isLoading,
  error,
  onSelectItem,
}: {
  intelligence: CampaignCalendarIntelligence | null;
  isLoading: boolean;
  error: string | null;
  onSelectItem: (item: CampaignCalendarIntelligenceItem | CampaignCalendarCriticalDate) => void;
}) {
  if (isLoading && !intelligence) {
    return (
      <CampaignStudioSectionCard
        eyebrow="Calendar Overview"
        title="Campaign Date Snapshot"
        description="Loading the campaign timeline summary."
      >
        <div className="campaign-studio__empty-note">Loading calendar overview...</div>
      </CampaignStudioSectionCard>
    );
  }

  if (error && !intelligence) {
    return (
      <CampaignStudioSectionCard
        eyebrow="Calendar Overview"
        title="Campaign Date Snapshot"
        description="The editable calendar is still available below."
      >
        <div className="alert alert-warning mb-0">{error}</div>
      </CampaignStudioSectionCard>
    );
  }

  if (!intelligence) {
    return null;
  }

  const attentionGroup = intelligence.agendaGroups.find((group) => group.key === 'needs_attention') ?? null;
  const missingGroup = intelligence.agendaGroups.find((group) => group.key === 'missing') ?? null;
  const upcomingGroup = intelligence.agendaGroups.find((group) => group.key === 'next_7_days')
    ?? intelligence.agendaGroups.find((group) => group.key === 'next_30_days')
    ?? null;

  return (
    <CampaignStudioSectionCard
      eyebrow="Calendar Overview"
      title="Campaign Date Snapshot"
      description="A condensed view of critical dates, overdue work, upcoming items, and missing blockers."
    >
      <div className="campaign-calendar-overview">
        <div className="campaign-calendar-overview__metrics" aria-label="Calendar summary">
          <CalendarMetric label="Overdue" value={intelligence.summary.overdueCount} tone={intelligence.summary.overdueCount > 0 ? 'danger' : 'neutral'} />
          <CalendarMetric label="Due Soon" value={intelligence.summary.dueSoonCount} tone={intelligence.summary.dueSoonCount > 0 ? 'warning' : 'neutral'} />
          <CalendarMetric label="Missing Dates" value={intelligence.summary.missingCriticalDatesCount} tone={intelligence.summary.missingCriticalDatesCount > 0 ? 'danger' : 'neutral'} />
          <CalendarMetric label="Scheduled Emails" value={intelligence.summary.scheduledCommunicationsCount} tone="neutral" />
        </div>

        {intelligence.warnings.length ? (
          <div className="campaign-calendar-warning-list" aria-label="Calendar warnings">
            {intelligence.warnings.slice(0, 3).map((warning) => (
              <div
                key={`${warning.code}-${warning.message}`}
                className={`campaign-calendar-warning-list__item is-${warning.severity}`}
              >
                <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="campaign-critical-date-strip" aria-label="Critical campaign dates">
          {intelligence.criticalDates.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`campaign-critical-date ${calendarStatusClass(item.status)} ${item.isBlocker ? 'is-blocker' : ''}`}
              onClick={() => onSelectItem(item)}
            >
              <span className="campaign-critical-date__label">{item.label}</span>
              <span className="campaign-critical-date__date">{formatCalendarDate(item.date)}</span>
              <span className="campaign-critical-date__meta">
                <span className={`campaign-calendar-status ${calendarStatusClass(item.status)}`}>{calendarStatusLabel(item.status)}</span>
                {item.isBlocker ? <span className="campaign-calendar-status is-blocker">Blocker</span> : null}
              </span>
            </button>
          ))}
        </div>

        <div className="campaign-calendar-agenda-grid">
          <CampaignCalendarAgendaList group={attentionGroup} fallbackLabel="Needs Attention" onSelectItem={onSelectItem} />
          <CampaignCalendarAgendaList group={upcomingGroup} fallbackLabel="Coming Up" onSelectItem={onSelectItem} />
          <CampaignCalendarAgendaList group={missingGroup} fallbackLabel="Missing Important Dates" onSelectItem={onSelectItem} />
        </div>
      </div>
    </CampaignStudioSectionCard>
  );
}

function CalendarMetric({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'warning' | 'danger' }) {
  return (
    <div className={`campaign-calendar-metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CampaignCalendarAgendaList({
  group,
  fallbackLabel,
  onSelectItem,
}: {
  group: CampaignCalendarAgendaGroup | null;
  fallbackLabel: string;
  onSelectItem: (item: CampaignCalendarIntelligenceItem) => void;
}) {
  const items = group?.items ?? [];
  return (
    <div className="campaign-calendar-agenda">
      <div className="campaign-calendar-agenda__header">
        <h3 className="h6 mb-0">{group?.label ?? fallbackLabel}</h3>
        <span className="campaign-chip campaign-chip-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="campaign-studio__empty-note mb-0">Nothing in this group.</div>
      ) : (
        <div className="campaign-calendar-agenda__items">
          {items.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`campaign-calendar-agenda-row ${calendarStatusClass(item.urgency)}`}
              onClick={() => onSelectItem(item)}
            >
              <span className="campaign-calendar-agenda-row__icon">
                <i className={`bi ${calendarItemIcon(item.itemType)}`} aria-hidden="true" />
              </span>
              <span className="campaign-calendar-agenda-row__body">
                <span className="campaign-calendar-agenda-row__title">{item.title}</span>
                <span className="campaign-calendar-agenda-row__meta">
                  {formatCalendarDate(item.date)}
                  {item.description ? ` · ${item.description}` : ''}
                </span>
              </span>
              <span className={`campaign-calendar-status ${calendarStatusClass(item.urgency)}`}>
                {calendarStatusLabel(item.urgency)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function findScheduleItemForIntelligenceItem(
  items: CampaignScheduleItem[],
  intelligenceItem: CampaignCalendarIntelligenceItem | CampaignCalendarCriticalDate
): CampaignScheduleItem | null {
  if (intelligenceItem.sourceType === 'manual') {
    const itemId = 'id' in intelligenceItem ? intelligenceItem.id : null;
    return items.find((item) => item.sourceType === 'manual' && item.id === itemId) ?? null;
  }
  if (intelligenceItem.sourceType === 'milestone' || intelligenceItem.sourceType === 'communication') {
    return items.find((item) => item.sourceType === intelligenceItem.sourceType && item.sourceId === intelligenceItem.sourceId) ?? null;
  }
  return null;
}

function formatCalendarDate(value: string | null): string {
  if (!value) {
    return 'Missing';
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function calendarStatusLabel(value: string): string {
  return {
    missing: 'Missing',
    overdue: 'Overdue',
    today: 'Today',
    due_soon: 'Soon',
    upcoming: 'Upcoming',
    future: 'Future',
    complete: 'Done',
    informational: 'Info',
  }[value] ?? value;
}

function calendarStatusClass(value: string): string {
  if (value === 'missing' || value === 'overdue') {
    return 'is-danger';
  }
  if (value === 'today' || value === 'due_soon') {
    return 'is-warning';
  }
  if (value === 'upcoming') {
    return 'is-info';
  }
  return 'is-neutral';
}

function calendarItemIcon(value: CampaignCalendarIntelligenceItem['itemType']): string {
  return {
    campaign_date: 'bi-calendar-range',
    milestone: 'bi-flag',
    manual_event: 'bi-calendar-event',
    communication: 'bi-envelope-paper',
    sponsor_dropoff: 'bi-box-arrow-in-down',
    sponsor_followup: 'bi-telephone-outbound',
    gift_workflow: 'bi-gift',
    readiness_blocker: 'bi-exclamation-triangle',
    missing_date: 'bi-calendar-x',
  }[value] ?? 'bi-calendar-event';
}

function sourceToEditorType(
  sourceType: CampaignScheduleItem['sourceType']
): CampaignScheduleEditorType {
  if (sourceType === 'milestone') {
    return 'milestone';
  }
  if (sourceType === 'communication') {
    return 'communication';
  }
  return 'event';
}
