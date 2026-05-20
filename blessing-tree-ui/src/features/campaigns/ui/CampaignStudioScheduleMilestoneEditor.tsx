import { useEffect, useState } from 'react';
import { milestoneDefinitions } from '@/features/campaigns/model/campaignStudio';
import type {
  CampaignMilestone,
  CampaignScheduleItem,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';

interface MilestoneFormState {
  milestoneKey: string;
  occursOn: string;
  notes: string;
}

interface CampaignStudioScheduleMilestoneEditorProps {
  milestones: CampaignMilestone[];
  editingItem: CampaignScheduleItem | null;
  selectedDate: string | null;
  isSaving: boolean;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onClose: () => void;
}

export function CampaignStudioScheduleMilestoneEditor({
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
    buildFormState(editingMilestone, selectedDate)
  );

  useEffect(() => {
    setFormState(buildFormState(editingMilestone, selectedDate));
  }, [editingMilestone, selectedDate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMilestones = buildNextMilestones(
      milestones,
      editingMilestone,
      formState
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
            <option key={definition.key} value={definition.key}>
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
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Clear Milestone
            </button>
          ) : null}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
            {editingMilestone ? 'Save Milestone' : 'Add Milestone'}
          </button>
        </div>
      </div>
    </form>
  );
}

function buildFormState(
  editingMilestone: CampaignMilestone | null,
  selectedDate: string | null
): MilestoneFormState {
  if (!editingMilestone) {
    return {
      milestoneKey: milestoneDefinitions[0]?.key ?? '',
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
  formState: MilestoneFormState
): SaveCampaignMilestoneInput[] {
  const definition = milestoneDefinitions.find(
    (milestone) => milestone.key === formState.milestoneKey
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
    milestoneKey: definition.key,
    label: definition.label,
    occursOn: formState.occursOn,
    notes: formState.notes.trim() || null,
    sortOrder: definition.sortOrder,
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
