import { useMemo } from 'react';
import {
  communicationTemplateMergeFieldGroups,
  renderTemplatePreview,
  renderTemplatePreviewParagraphs,
  type CommunicationTemplateDraft,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import { communicationAudienceOptions } from '@/features/campaigns/model/campaignStudio';

interface CampaignStudioTemplateWorkspaceProps {
  draft: CommunicationTemplateDraft;
  activeTab: 'metadata' | 'content';
  isSaving: boolean;
  isExisting: boolean;
  onChangeTab: (tab: 'metadata' | 'content') => void;
  onChangeDraft: (
    updater: (currentDraft: CommunicationTemplateDraft) => CommunicationTemplateDraft
  ) => void;
  onSave: () => void;
  onInsertMergeField: (field: string) => void;
  onFocusField: (field: 'subjectTemplate' | 'bodyTemplate') => void;
}

export function CampaignStudioTemplateWorkspace({
  draft,
  activeTab,
  isSaving,
  isExisting,
  onChangeTab,
  onChangeDraft,
  onSave,
  onInsertMergeField,
  onFocusField,
}: CampaignStudioTemplateWorkspaceProps) {
  const previewSubject = useMemo(
    () => renderTemplatePreview(draft.subjectTemplate),
    [draft.subjectTemplate]
  );
  const previewParagraphs = useMemo(
    () => renderTemplatePreviewParagraphs(draft.bodyTemplate),
    [draft.bodyTemplate]
  );

  return (
    <section className="campaign-template-workspace" aria-label="Communication template builder">
      <div className="campaign-template-workspace__header">
        <div>
          <div className="campaign-studio__eyebrow">
            {isExisting ? 'Editing Template' : 'New Template'}
          </div>
          <h3 className="mb-1">{draft.name.trim() || 'Untitled communication template'}</h3>
          <div className="campaign-chip-row">
            <span className="campaign-chip">{draft.audience}</span>
            <span className={`campaign-chip ${draft.isActive ? '' : 'campaign-chip-muted'}`}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={isSaving}
          onClick={onSave}
        >
          <i className="bi bi-floppy" aria-hidden="true" />{' '}
          {isExisting ? 'Save Template' : 'Create Template'}
        </button>
      </div>

      <div className="campaign-template-workspace__tabs" role="tablist" aria-label="Template builder tabs">
        <button
          type="button"
          className={activeTab === 'metadata' ? 'is-active' : ''}
          onClick={() => onChangeTab('metadata')}
        >
          Metadata
        </button>
        <button
          type="button"
          className={activeTab === 'content' ? 'is-active' : ''}
          onClick={() => onChangeTab('content')}
        >
          Content
        </button>
      </div>

      {activeTab === 'metadata' ? (
        <div className="campaign-template-workspace__metadata">
          <label className="form-label">
            Template Name
            <input
              className="form-control"
              value={draft.name}
              onChange={(event) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-label">
            Template Key
            <input
              className="form-control"
              value={draft.templateKey}
              onChange={(event) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  templateKey: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-label campaign-studio__form-span-2">
            Audience
            <select
              className="form-select"
              value={draft.audience}
              onChange={(event) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  audience: event.target.value,
                }))
              }
            >
              {communicationAudienceOptions.map((audience) => (
                <option key={audience} value={audience}>
                  {audience}
                </option>
              ))}
            </select>
          </label>
          <label className="campaign-template-workspace__toggle">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  isActive: event.target.checked,
                }))
              }
            />
            <span>Template is active and available to the campaign scheduler.</span>
          </label>
        </div>
      ) : (
        <div className="campaign-template-workspace__content">
          <div className="campaign-template-workspace__editor-column">
            <label className="form-label">
              Subject
              <input
                className="form-control"
                value={draft.subjectTemplate}
                onFocus={() => onFocusField('subjectTemplate')}
                onChange={(event) =>
                  onChangeDraft((currentDraft) => ({
                    ...currentDraft,
                    subjectTemplate: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-label">
              Body
              <textarea
                className="form-control"
                rows={14}
                value={draft.bodyTemplate}
                onFocus={() => onFocusField('bodyTemplate')}
                onChange={(event) =>
                  onChangeDraft((currentDraft) => ({
                    ...currentDraft,
                    bodyTemplate: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="campaign-template-workspace__preview-column">
            <div className="campaign-template-preview-card">
              <div className="campaign-template-preview-card__heading">
                <span className="campaign-studio__eyebrow">Email Preview</span>
                <strong>Rendered sample</strong>
              </div>
              <div className="campaign-template-preview-card__subject">
                {previewSubject || 'Subject line preview'}
              </div>
              <div className="campaign-template-preview-card__body">
                {previewParagraphs.length > 0 ? (
                  previewParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p className="text-muted mb-0">Body preview will appear here.</p>
                )}
              </div>
            </div>

            <div className="campaign-template-merge-fields">
              <div className="campaign-template-preview-card__heading">
                <span className="campaign-studio__eyebrow">Merge Fields</span>
                <strong>Insert sample fields</strong>
              </div>
              {communicationTemplateMergeFieldGroups.map((group) => (
                <div key={group.label} className="campaign-template-merge-fields__group">
                  <div className="campaign-template-merge-fields__label">{group.label}</div>
                  <div className="campaign-chip-row">
                    {group.fields.map((field) => (
                      <button
                        key={field}
                        type="button"
                        className="campaign-template-merge-fields__chip"
                        onClick={() => onInsertMergeField(field)}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
