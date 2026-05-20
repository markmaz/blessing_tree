import { useEffect, useState } from 'react';
import {
  manualCampaignEventTypeOptions,
  toDateInputValue,
  toDateTimeInputValue,
} from '@/features/campaigns/model/campaignSchedule';
import type {
  CampaignScheduleItem,
  CreateCampaignEventInput,
  UpdateCampaignEventInput,
} from '@/features/campaigns/model/campaignStudioTypes';

interface EventFormState {
  title: string;
  eventType: CreateCampaignEventInput['eventType'];
  startAt: string;
  endAt: string;
  allDay: boolean;
  notes: string;
}

interface CampaignStudioScheduleEventEditorProps {
  editingItem: CampaignScheduleItem | null;
  selectedDate: string | null;
  isSaving: boolean;
  onCreateEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onUpdateEvent: (eventId: string, input: UpdateCampaignEventInput) => Promise<boolean>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onClose: () => void;
}

const emptyFormState: EventFormState = {
  title: '',
  eventType: 'GENERAL',
  startAt: '',
  endAt: '',
  allDay: true,
  notes: '',
};

export function CampaignStudioScheduleEventEditor({
  editingItem,
  selectedDate,
  isSaving,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onClose,
}: CampaignStudioScheduleEventEditorProps) {
  const [formState, setFormState] = useState<EventFormState>(() =>
    buildFormState(editingItem, selectedDate)
  );

  useEffect(() => {
    setFormState(buildFormState(editingItem, selectedDate));
  }, [editingItem, selectedDate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      title: formState.title.trim(),
      eventType: formState.eventType,
      startAt: normalizeDateValue(formState.startAt, formState.allDay),
      endAt: formState.endAt ? normalizeDateValue(formState.endAt, formState.allDay) : null,
      allDay: formState.allDay,
      notes: formState.notes.trim() || null,
    };

    const didSave = editingItem
      ? await onUpdateEvent(editingItem.id, payload)
      : await onCreateEvent(payload);

    if (didSave) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!editingItem) {
      return;
    }
    const confirmed = window.confirm(`Delete "${editingItem.title}" from the calendar?`);
    if (!confirmed) {
      return;
    }
    const didDelete = await onDeleteEvent(editingItem.id);
    if (didDelete) {
      onClose();
    }
  };

  return (
    <form className="campaign-studio__modal-form-grid" onSubmit={handleSubmit}>
      <label className="form-label">
        Title
        <input
          className="form-control"
          value={formState.title}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              title: event.target.value,
            }))
          }
          required
        />
      </label>

      <label className="form-label">
        Event Type
        <select
          className="form-select"
          value={formState.eventType}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              eventType: event.target.value as EventFormState['eventType'],
            }))
          }
        >
          {manualCampaignEventTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Start {formState.allDay ? 'Date' : 'Time'}
        <input
          className="form-control"
          type={formState.allDay ? 'date' : 'datetime-local'}
          value={formState.startAt}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              startAt: event.target.value,
            }))
          }
          required
        />
      </label>

      <label className="form-label">
        End {formState.allDay ? 'Date' : 'Time'}
        <input
          className="form-control"
          type={formState.allDay ? 'date' : 'datetime-local'}
          value={formState.endAt}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              endAt: event.target.value,
            }))
          }
        />
      </label>

      <label className="form-label campaign-studio__modal-form-span-2">
        <input
          className="form-check-input me-2"
          type="checkbox"
          checked={formState.allDay}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              allDay: event.target.checked,
              startAt: retargetDateValue(currentState.startAt, event.target.checked),
              endAt: retargetDateValue(currentState.endAt, event.target.checked),
            }))
          }
        />
        All-day event
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
          {editingItem ? (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete Event
            </button>
          ) : null}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
            {editingItem ? 'Save Event' : 'Add Event'}
          </button>
        </div>
      </div>
    </form>
  );
}

function buildFormState(
  editingItem: CampaignScheduleItem | null,
  selectedDate: string | null
): EventFormState {
  if (!editingItem) {
    return {
      ...emptyFormState,
      startAt: selectedDate ?? '',
      endAt: selectedDate ?? '',
    };
  }

  return {
    title: editingItem.title,
    eventType: editingItem.eventType,
    startAt: editingItem.allDay
      ? toDateInputValue(editingItem.startAt)
      : toDateTimeInputValue(editingItem.startAt),
    endAt: editingItem.allDay
      ? toDateInputValue(editingItem.endAt)
      : toDateTimeInputValue(editingItem.endAt),
    allDay: editingItem.allDay,
    notes: editingItem.notes ?? '',
  };
}

function normalizeDateValue(value: string, allDay: boolean): string {
  if (!allDay) {
    return value;
  }
  return value ? `${value}T00:00` : value;
}

function retargetDateValue(value: string, allDay: boolean): string {
  if (!value) {
    return '';
  }
  return allDay ? value.slice(0, 10) : `${value.slice(0, 10)}T09:00`;
}
