import { useState } from 'react';
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
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface EventFormState {
  title: string;
  eventType: CreateCampaignEventInput['eventType'];
  startAt: string;
  endAt: string;
  allDay: boolean;
  notes: string;
}

interface CampaignStudioScheduleEventFormProps {
  isSaving: boolean;
  editingItem: CampaignScheduleItem | null;
  onCreateEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onUpdateEvent: (eventId: string, input: UpdateCampaignEventInput) => Promise<boolean>;
  onCancelEdit: () => void;
}

const emptyFormState: EventFormState = {
  title: '',
  eventType: 'GENERAL',
  startAt: '',
  endAt: '',
  allDay: true,
  notes: '',
};

export function CampaignStudioScheduleEventForm({
  isSaving,
  editingItem,
  onCreateEvent,
  onUpdateEvent,
  onCancelEdit,
}: CampaignStudioScheduleEventFormProps) {
  const [formState, setFormState] = useState<EventFormState>(() =>
    buildFormState(editingItem)
  );

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
      setFormState(emptyFormState);
      onCancelEdit();
    }
  };

  return (
    <CampaignStudioSectionCard
      eyebrow="Manual Event"
      title={editingItem ? 'Edit Planning Event' : 'Add Planning Event'}
      description="Manual events are the editable planning layer for volunteer days, sorting sessions, pickup weekends, and other operator-defined work."
    >
      <form className="campaign-studio__event-form-grid" onSubmit={handleSubmit}>
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

        <label className="form-label campaign-studio__form-span-2">
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

        <label className="form-label campaign-studio__form-span-2">
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

        <div className="campaign-studio__form-span-2 campaign-studio__event-form-actions">
          <div>
            {editingItem ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setFormState(emptyFormState);
                  onCancelEdit();
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="campaign-studio__event-form-main-actions">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
              {editingItem ? 'Save Event' : 'Add Event'}
            </button>
          </div>
        </div>
      </form>
    </CampaignStudioSectionCard>
  );
}

function buildFormState(editingItem: CampaignScheduleItem | null): EventFormState {
  if (!editingItem) {
    return emptyFormState;
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
