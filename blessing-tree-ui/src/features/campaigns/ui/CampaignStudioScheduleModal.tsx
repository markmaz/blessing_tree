import type {
  CampaignMilestone,
  CampaignScheduleItem,
  CommunicationSchedule,
  CommunicationTemplate,
  CreateCampaignEventInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
  UpdateCampaignEventInput,
  UpdateCommunicationScheduleInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioScheduleCommunicationEditor } from '@/features/campaigns/ui/CampaignStudioScheduleCommunicationEditor';
import { CampaignStudioScheduleEventEditor } from '@/features/campaigns/ui/CampaignStudioScheduleEventEditor';
import { CampaignStudioScheduleMilestoneEditor } from '@/features/campaigns/ui/CampaignStudioScheduleMilestoneEditor';

export type CampaignScheduleEditorType = 'event' | 'milestone' | 'communication';

interface CampaignStudioScheduleModalProps {
  isOpen: boolean;
  editorType: CampaignScheduleEditorType;
  isEditing: boolean;
  item: CampaignScheduleItem | null;
  selectedDate: string | null;
  milestones: CampaignMilestone[];
  schedules: CommunicationSchedule[];
  templates: CommunicationTemplate[];
  isSaving: boolean;
  onSelectType: (type: CampaignScheduleEditorType) => void;
  onClose: () => void;
  onCreateEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onUpdateEvent: (eventId: string, input: UpdateCampaignEventInput) => Promise<boolean>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onCreateSchedule: (input: CreateCommunicationScheduleInput) => Promise<boolean>;
  onUpdateSchedule: (
    scheduleId: string,
    input: UpdateCommunicationScheduleInput
  ) => Promise<boolean>;
  onDeleteSchedule: (scheduleId: string) => Promise<boolean>;
}

export function CampaignStudioScheduleModal({
  isOpen,
  editorType,
  isEditing,
  item,
  selectedDate,
  milestones,
  schedules,
  templates,
  isSaving,
  onSelectType,
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onSaveMilestones,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: CampaignStudioScheduleModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="campaign-studio__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="campaign-studio__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-schedule-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="campaign-studio__modal-header">
          <div>
            <div className="campaign-studio__eyebrow">Calendar Editor</div>
            <h3 id="campaign-schedule-modal-title" className="h5 mb-1">
              {getModalTitle(editorType, isEditing)}
            </h3>
            <p className="small text-muted mb-0">
              {isEditing
                ? 'Update the selected schedule record directly from the calendar.'
                : 'Create a new milestone, communication, or planning event on the calendar.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            aria-label="Close calendar editor"
          >
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Close
          </button>
        </div>

        {!isEditing ? (
          <div className="campaign-studio__modal-type-switch">
            {scheduleEditorTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`campaign-studio__modal-type-button ${
                  editorType === type.id ? 'is-selected' : ''
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <i className={`bi ${type.icon}`} aria-hidden="true" />
                <span className="fw-semibold">{type.label}</span>
                <span className="small text-muted">{type.description}</span>
              </button>
            ))}
          </div>
        ) : null}

        {editorType === 'event' ? (
          <CampaignStudioScheduleEventEditor
            editingItem={item}
            selectedDate={selectedDate}
            isSaving={isSaving}
            onCreateEvent={onCreateEvent}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent}
            onClose={onClose}
          />
        ) : null}

        {editorType === 'milestone' ? (
          <CampaignStudioScheduleMilestoneEditor
            milestones={milestones}
            editingItem={item}
            selectedDate={selectedDate}
            isSaving={isSaving}
            onSaveMilestones={onSaveMilestones}
            onClose={onClose}
          />
        ) : null}

        {editorType === 'communication' ? (
          <CampaignStudioScheduleCommunicationEditor
            schedules={schedules}
            templates={templates}
            editingScheduleId={item?.sourceType === 'communication' ? item.sourceId : null}
            selectedDate={selectedDate}
            isSaving={isSaving}
            onCreateSchedule={onCreateSchedule}
            onUpdateSchedule={onUpdateSchedule}
            onDeleteSchedule={onDeleteSchedule}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}

function getModalTitle(
  editorType: CampaignScheduleEditorType,
  isEditing: boolean
): string {
  const verb = isEditing ? 'Edit' : 'Add';
  if (editorType === 'event') {
    return `${verb} Calendar Event`;
  }
  if (editorType === 'milestone') {
    return `${verb} Milestone`;
  }
  return `${verb} Communication`;
}

const scheduleEditorTypes: Array<{
  id: CampaignScheduleEditorType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'event',
    label: 'Event',
    description: 'Operator-owned calendar blocks like orientation or sorting.',
    icon: 'bi-calendar-plus',
  },
  {
    id: 'milestone',
    label: 'Milestone',
    description: 'Named campaign checkpoints like registration open or pickup start.',
    icon: 'bi-signpost-2',
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Emails and reminders tied to a date or milestone.',
    icon: 'bi-envelope-paper',
  },
];
