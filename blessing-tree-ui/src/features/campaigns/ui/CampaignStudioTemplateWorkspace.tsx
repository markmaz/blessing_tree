import type {
  CommunicationTemplateDraft,
  CommunicationTemplateFocusTarget,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import { communicationAudienceOptions } from '@/features/campaigns/model/campaignStudio';
import { CampaignStudioTemplateBlockEditor } from '@/features/campaigns/ui/CampaignStudioTemplateBlockEditor';
import { CampaignStudioTemplatePreviewPanel } from '@/features/campaigns/ui/CampaignStudioTemplatePreviewPanel';

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
  onFocusTarget: (target: CommunicationTemplateFocusTarget) => void;
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
  onFocusTarget,
}: CampaignStudioTemplateWorkspaceProps) {
  return (
    <section className="campaign-template-workspace" aria-label="Communication template builder">
      <div className="campaign-template-workspace__header">
        <div>
          <div className="campaign-studio__eyebrow">
            {isExisting ? 'Editing Template' : 'New Template'}
          </div>
          <h3 className="mb-1">{draft.name.trim() || 'Untitled communication template'}</h3>
          <div className="campaign-template-badge-row">
            <span className="campaign-template-badge">{draft.audience}</span>
            <span className={`campaign-template-badge ${draft.isActive ? '' : 'is-muted'}`}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="campaign-template-badge is-muted">
              {draft.bodyBlocks.length} blocks
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
          Content Blocks
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
                onFocus={() => onFocusTarget({ kind: 'subject' })}
                onChange={(event) =>
                  onChangeDraft((currentDraft) => ({
                    ...currentDraft,
                    subjectTemplate: event.target.value,
                  }))
                }
              />
            </label>

            <CampaignStudioTemplateBlockEditor
              blocks={draft.bodyBlocks}
              isSaving={isSaving}
              onChangeBlocks={(bodyBlocks) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  bodyBlocks,
                }))
              }
              onFocusBlockField={(blockId, field) =>
                onFocusTarget({ kind: 'block', blockId, field })
              }
            />
          </div>

          <CampaignStudioTemplatePreviewPanel
            subjectTemplate={draft.subjectTemplate}
            blocks={draft.bodyBlocks}
            onInsertMergeField={onInsertMergeField}
          />
        </div>
      )}
    </section>
  );
}
