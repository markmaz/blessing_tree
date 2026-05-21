import { useEffect, useMemo, useState } from 'react';
import { milestoneDefinitions } from '@/features/campaigns/model/campaignStudio';
import type {
  CommunicationSchedule,
  CommunicationTemplate,
  CreateCommunicationScheduleInput,
  UpdateCommunicationScheduleInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';

interface CommunicationFormState {
  templateId: string;
  milestoneKey: string;
  scheduledFor: string;
  status: CreateCommunicationScheduleInput['status'];
  notes: string;
}

interface CampaignStudioScheduleCommunicationEditorProps {
  schedules: CommunicationSchedule[];
  templates: CommunicationTemplate[];
  editingScheduleId: string | null;
  selectedDate: string | null;
  isSaving: boolean;
  onCreateSchedule: (input: CreateCommunicationScheduleInput) => Promise<boolean>;
  onUpdateSchedule: (
    scheduleId: string,
    input: UpdateCommunicationScheduleInput
  ) => Promise<boolean>;
  onDeleteSchedule: (scheduleId: string) => Promise<boolean>;
  onClose: () => void;
}

export function CampaignStudioScheduleCommunicationEditor({
  schedules,
  templates,
  editingScheduleId,
  selectedDate,
  isSaving,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onClose,
}: CampaignStudioScheduleCommunicationEditorProps) {
  const editingSchedule =
    schedules.find((schedule) => schedule.id === editingScheduleId) ?? null;
  const templateOptions = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.isActive || template.id === editingSchedule?.templateId
      ),
    [editingSchedule?.templateId, templates]
  );
  const [formState, setFormState] = useState<CommunicationFormState>(() =>
    buildFormState(editingSchedule, templateOptions, selectedDate)
  );

  useEffect(() => {
    setFormState(buildFormState(editingSchedule, templateOptions, selectedDate));
  }, [editingSchedule, templateOptions, selectedDate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      templateId: formState.templateId,
      milestoneKey: formState.milestoneKey || null,
      scheduledFor: formState.scheduledFor || null,
      status: formState.status,
      notes: formState.notes.trim() || null,
    };

    const didSave = editingSchedule
      ? await onUpdateSchedule(editingSchedule.id, payload)
      : await onCreateSchedule(payload);

    if (didSave) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!editingSchedule) {
      return;
    }
    const didDelete = await onDeleteSchedule(editingSchedule.id);
    if (didDelete) {
      onClose();
    }
  };

  if (templateOptions.length === 0 && !editingSchedule) {
    return (
      <div className="campaign-studio__empty-note">
        Add a communication template first so the calendar can place a real email or reminder.
      </div>
    );
  }

  return (
    <form className="campaign-studio__modal-form-grid" onSubmit={handleSubmit}>
      <label className="form-label campaign-studio__modal-form-span-2">
        Template
        <select
          className="form-select"
          value={formState.templateId}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              templateId: event.target.value,
            }))
          }
          required
        >
          <option value="">Select a template</option>
          {templateOptions.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Milestone
        <select
          className="form-select"
          value={formState.milestoneKey}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              milestoneKey: event.target.value,
            }))
          }
        >
          <option value="">No milestone</option>
          {milestoneDefinitions.map((definition) => (
            <option key={definition.key} value={definition.key}>
              {definition.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Status
        <select
          className="form-select"
          value={formState.status}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              status: event.target.value as CommunicationFormState['status'],
            }))
          }
        >
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </label>

      <label className="form-label campaign-studio__modal-form-span-2">
        Specific Send Time
        <input
          type="datetime-local"
          className="form-control"
          value={formState.scheduledFor}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              scheduledFor: event.target.value,
            }))
          }
        />
      </label>

      <label className="form-label campaign-studio__modal-form-span-2">
        Notes
        <textarea
          className="form-control"
          rows={4}
          value={formState.notes}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              notes: event.target.value,
            }))
          }
        />
      </label>

      <div className="campaign-studio__modal-actions">
        <div className="d-flex gap-2">
          {editingSchedule ? (
            <InlineConfirmAction
              buttonLabel="Delete Communication"
              confirmLabel="Delete Communication"
              message={`Delete "${editingSchedule.template.name}" from the calendar?`}
              disabled={isSaving}
              onConfirm={handleDelete}
            />
          ) : null}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
            <i
              className={`bi ${editingSchedule ? 'bi-floppy' : 'bi-envelope-plus'} me-2`}
              aria-hidden="true"
            />
            {editingSchedule ? 'Save Communication' : 'Add Communication'}
          </button>
        </div>
      </div>
    </form>
  );
}

function buildFormState(
  editingSchedule: CommunicationSchedule | null,
  templates: CommunicationTemplate[],
  selectedDate: string | null
): CommunicationFormState {
  if (!editingSchedule) {
    return {
      templateId: templates[0]?.id ?? '',
      milestoneKey: '',
      scheduledFor: selectedDate ? `${selectedDate}T09:00` : '',
      status: selectedDate ? 'SCHEDULED' : 'DRAFT',
      notes: '',
    };
  }

  return {
    templateId: editingSchedule.templateId,
    milestoneKey: editingSchedule.milestoneKey ?? '',
    scheduledFor: editingSchedule.scheduledFor?.slice(0, 16) ?? '',
    status: editingSchedule.status,
    notes: editingSchedule.notes ?? '',
  };
}
