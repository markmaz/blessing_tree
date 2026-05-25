import { useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioSchedule.css';
import { formatScheduleDateRange, sourceLabel } from '@/features/campaigns/model/campaignSchedule';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignMilestone,
  CampaignMilestoneDefinition,
  CampaignScheduleItem,
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
  access: CampaignAccess;
  items: CampaignScheduleItem[];
  milestoneDefinitions: CampaignMilestoneDefinition[];
  milestones: CampaignMilestone[];
  schedules: CommunicationSchedule[];
  templates: CommunicationTemplate[];
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
}

const closedModalState: ScheduleModalState = {
  isOpen: false,
  editorType: 'event',
  selectedDate: null,
  item: null,
};

export function CampaignStudioScheduleSection({
  access,
  items,
  milestoneDefinitions,
  milestones,
  schedules,
  templates,
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

  const openCreateModal = (selectedDate: string) => {
    if (!canAdministerSchedule) {
      return;
    }
    setModalState({
      isOpen: true,
      editorType: 'event',
      selectedDate,
      item: null,
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
    });
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
        milestoneDefinitions={milestoneDefinitions}
        milestones={milestones}
        schedules={schedules}
        templates={templates}
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
