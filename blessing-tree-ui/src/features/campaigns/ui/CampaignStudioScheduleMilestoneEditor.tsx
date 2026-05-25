import { useEffect, useState } from 'react';
import type {
  CampaignMilestone,
  CampaignMilestoneDefinition,
  CampaignScheduleItem,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';

interface MilestoneFormState {
  milestoneKey: string;
  occursOn: string;
  notes: string;
}

interface CampaignStudioScheduleMilestoneEditorProps {
  milestoneDefinitions: CampaignMilestoneDefinition[];
  milestones: CampaignMilestone[];
  editingItem: CampaignScheduleItem | null;
  selectedDate: string | null;
  isSaving: boolean;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onClose: () => void;
}

export function CampaignStudioScheduleMilestoneEditor({
  milestoneDefinitions,
  milestones,
  editingItem,
  selectedDate,
  isSaving,
  onSaveMilestones,
  onClose,
}: CampaignStudioScheduleMilestoneEditorProps) {
  const editingMilestone =
    editingItem?.sourceType === 'milestone'
      ? milestones.find((milestone) => milestone.id === editingItem.sourceId) ?? null
      : null;
  const [formState, setFormState] = useState<MilestoneFormState>(() =>
    buildFormState(editingMilestone, selectedDate, milestoneDefinitions)
  );

  useEffect(() => {
    setFormState(buildFormState(editingMilestone, selectedDate, milestoneDefinitions));
  }, [editingMilestone, selectedDate, milestoneDefinitions]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMilestones = buildNextMilestones(
      milestones,
      editingMilestone,
      formState,
      milestoneDefinitions
    );
    const didSave = await onSaveMilestones(nextMilestones);
    if (didSave) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!editingMilestone) {
      return;
    }
    const nextMilestones = milestones
      .filter((milestone) => milestone.id !== editingMilestone.id)
      .map(toSaveInput);
    const didSave = await onSaveMilestones(nextMilestones);
    if (didSave) {
      onClose();
    }
  };

  return (
    <form className="campaign-studio__modal-form-grid" onSubmit={handleSubmit}>
      <label className="form-label campaign-studio__modal-form-span-2">
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
          required
        >
          {milestoneDefinitions.map((definition) => (
            <option key={definition.milestoneKey} value={definition.milestoneKey}>
              {definition.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Date
        <input
          className="form-control"
          type="date"
          value={formState.occursOn}
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              occursOn: event.target.value,
            }))
          }
          required
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
          placeholder="Optional milestone context or operator notes."
        />
      </label>

      <div className="campaign-studio__modal-actions">
        <div className="d-flex gap-2">
          {editingMilestone ? (
            <InlineConfirmAction
              buttonLabel="Clear Milestone"
              confirmLabel="Clear Milestone"
              message={`Clear the date for "${editingMilestone.label}"?`}
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
              className={`bi ${editingMilestone ? 'bi-floppy' : 'bi-flag'} me-2`}
              aria-hidden="true"
            />
            {editingMilestone ? 'Save Milestone' : 'Add Milestone'}
          </button>
        </div>
      </div>
    </form>
  );
}

function buildFormState(
  editingMilestone: CampaignMilestone | null,
  selectedDate: string | null,
  milestoneDefinitions: CampaignMilestoneDefinition[]
): MilestoneFormState {
  if (!editingMilestone) {
    return {
      milestoneKey: milestoneDefinitions[0]?.milestoneKey ?? '',
      occursOn: selectedDate ?? '',
      notes: '',
    };
  }

  return {
    milestoneKey: editingMilestone.milestoneKey,
    occursOn: editingMilestone.occursOn ?? selectedDate ?? '',
    notes: editingMilestone.notes ?? '',
  };
}

function buildNextMilestones(
  milestones: CampaignMilestone[],
  editingMilestone: CampaignMilestone | null,
  formState: MilestoneFormState,
  milestoneDefinitions: CampaignMilestoneDefinition[]
): SaveCampaignMilestoneInput[] {
  const definition = milestoneDefinitions.find(
    (milestone) => milestone.milestoneKey === formState.milestoneKey
  );

  if (!definition) {
    return milestones.map(toSaveInput);
  }

  const nextMilestones = milestones
    .filter(
      (milestone) =>
        milestone.id !== editingMilestone?.id &&
        milestone.milestoneKey !== formState.milestoneKey
    )
    .map(toSaveInput);

  nextMilestones.push({
    milestoneKey: definition.milestoneKey,
    label: definition.label,
    occursOn: formState.occursOn,
    notes: formState.notes.trim() || null,
    sortOrder: definition.defaultSortOrder,
  });

  return nextMilestones.sort((left, right) => left.sortOrder - right.sortOrder);
}

function toSaveInput(milestone: CampaignMilestone): SaveCampaignMilestoneInput {
  return {
    milestoneKey: milestone.milestoneKey,
    label: milestone.label,
    occursOn: milestone.occursOn ?? '',
    notes: milestone.notes,
    sortOrder: milestone.sortOrder,
  };
}
