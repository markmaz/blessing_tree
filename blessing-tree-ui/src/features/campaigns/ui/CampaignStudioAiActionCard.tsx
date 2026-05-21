import { useState } from 'react';
import { campaignStatusOptions } from '@/features/campaigns/model/campaignEditor';
import {
  isSuggestStatusChangeAction,
  isUpdateCampaignSettingsAction,
  type CampaignStudioAiAction,
  type UpdateCampaignSettingsAiPayload,
} from '@/features/campaigns/model/campaignStudioAiDraft';

interface CampaignStudioAiActionCardProps {
  action: CampaignStudioAiAction;
  isSaving: boolean;
  onApplyAction: (action: CampaignStudioAiAction) => void;
  onActionChange: (action: CampaignStudioAiAction) => void;
}

export function CampaignStudioAiActionCard({
  action,
  isSaving,
  onApplyAction,
  onActionChange,
}: CampaignStudioAiActionCardProps) {
  const editableSettingsAction =
    isUpdateCampaignSettingsAction(action) || isSuggestStatusChangeAction(action);
  const [isEditing, setIsEditing] = useState(false);
  const [draftPayload, setDraftPayload] = useState<UpdateCampaignSettingsAiPayload | null>(null);

  const handleSaveChanges = () => {
    if (!editableSettingsAction || !draftPayload) {
      return;
    }

    onActionChange({
      ...action,
      payload: {
        ...draftPayload,
        name: draftPayload.name.trim(),
        year: Number(draftPayload.year),
        description: draftPayload.description?.trim() || null,
        startDate: draftPayload.startDate || null,
        endDate: draftPayload.endDate || null,
      },
    });
    setIsEditing(false);
    setDraftPayload(null);
  };

  return (
    <div className="campaign-studio__ai-action-card">
      <div className="campaign-studio__ai-action-header">
        <div>
          <div className="fw-semibold small">{action.title}</div>
          <div className="small text-muted">{action.summary}</div>
        </div>
        <span className="campaign-chip campaign-chip-muted">
          {action.status.replaceAll('_', ' ')}
        </span>
      </div>

      {action.assumptions.length > 0 ? (
        <ul className="campaign-studio__ai-draft-list">
          {action.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      ) : null}

      {action.warnings.length > 0 ? (
        <ul className="campaign-studio__ai-draft-list">
          {action.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {editableSettingsAction && isEditing && draftPayload ? (
        <div className="campaign-studio__ai-edit-form">
          <div className="campaign-studio__ai-edit-grid">
            <label className="form-label">
              Campaign Name
              <input
                className="form-control form-control-sm"
                value={draftPayload.name}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, name: event.target.value }
                      : currentValue
                  )
                }
              />
            </label>

            <label className="form-label">
              Year
              <input
                type="number"
                className="form-control form-control-sm"
                value={draftPayload.year}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, year: Number(event.target.value || currentValue.year) }
                      : currentValue
                  )
                }
              />
            </label>

            <label className="form-label">
              Status
              <select
                className="form-select form-select-sm"
                value={draftPayload.status}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, status: event.target.value as UpdateCampaignSettingsAiPayload['status'] }
                      : currentValue
                  )
                }
              >
                {campaignStatusOptions.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Start Date
              <input
                type="date"
                className="form-control form-control-sm"
                value={draftPayload.startDate ?? ''}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, startDate: event.target.value || null }
                      : currentValue
                  )
                }
              />
            </label>

            <label className="form-label">
              End Date
              <input
                type="date"
                className="form-control form-control-sm"
                value={draftPayload.endDate ?? ''}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, endDate: event.target.value || null }
                      : currentValue
                  )
                }
              />
            </label>

            <label className="form-label campaign-studio__ai-edit-span-2">
              Description
              <textarea
                className="form-control form-control-sm"
                rows={4}
                value={draftPayload.description ?? ''}
                onChange={(event) =>
                  setDraftPayload((currentValue) =>
                    currentValue
                      ? { ...currentValue, description: event.target.value || null }
                      : currentValue
                  )
                }
              />
            </label>
          </div>

          <div className="campaign-studio__ai-action-buttons">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleSaveChanges}
            >
              <i className="bi bi-save2" aria-hidden="true" />
              <span>Save Draft Changes</span>
            </button>
            <button
              type="button"
            className="btn btn-link btn-sm"
              onClick={() => {
                setIsEditing(false);
                setDraftPayload(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="campaign-studio__ai-action-buttons">
        {editableSettingsAction ? (
          <button
            type="button"
            className="btn btn-link btn-sm campaign-studio__ai-edit-btn"
            disabled={isSaving}
            onClick={() => {
              if (!editableSettingsAction) {
                return;
              }

              if (isEditing) {
                setIsEditing(false);
                setDraftPayload(null);
                return;
              }

              setDraftPayload(action.payload);
              setIsEditing(true);
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>{isEditing ? 'Hide Edit Form' : 'Edit Before Apply'}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSaving || action.status === 'blocked'}
          onClick={() => onApplyAction(action)}
        >
          <i className="bi bi-check2-square" aria-hidden="true" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
}
