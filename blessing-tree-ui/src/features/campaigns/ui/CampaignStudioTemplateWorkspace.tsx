import { useState } from 'react';
import type {
  CommunicationTemplateDraft,
  CommunicationTemplateFocusTarget,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import {
  getCommunicationAudienceCatalog,
  getCommunicationAudienceLabel,
  getCommunicationAudienceOption,
} from '@/features/campaigns/model/campaignStudioCommunicationsPresentation';
import type {
  CommunicationAudienceKey,
  CommunicationAudienceOption,
  CommunicationAudienceRecipientSummary,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioTemplateBlockEditor } from '@/features/campaigns/ui/CampaignStudioTemplateBlockEditor';
import { CampaignStudioTemplateMergeFieldDrawer } from '@/features/campaigns/ui/CampaignStudioTemplateMergeFieldDrawer';
import { CampaignStudioTemplatePreviewPanel } from '@/features/campaigns/ui/CampaignStudioTemplatePreviewPanel';

interface CampaignStudioTemplateWorkspaceProps {
  draft: CommunicationTemplateDraft;
  audienceCatalog: CommunicationAudienceOption[];
  audienceRecipientSummaries?: CommunicationAudienceRecipientSummary[];
  activeTab: 'metadata' | 'content';
  isSaving: boolean;
  isExisting: boolean;
  onChangeTab: (tab: 'metadata' | 'content') => void;
  onChangeDraft: (
    updater: (currentDraft: CommunicationTemplateDraft) => CommunicationTemplateDraft
  ) => void;
  onSave: () => void;
  onSendTestEmail: (recipientEmail?: string) => Promise<unknown>;
  onInsertMergeField: (field: string) => void;
  onFocusTarget: (target: CommunicationTemplateFocusTarget) => void;
}

export function CampaignStudioTemplateWorkspace({
  draft,
  audienceCatalog,
  audienceRecipientSummaries = [],
  activeTab,
  isSaving,
  isExisting,
  onChangeTab,
  onChangeDraft,
  onSave,
  onSendTestEmail,
  onInsertMergeField,
  onFocusTarget,
}: CampaignStudioTemplateWorkspaceProps) {
  const [isMergeDrawerOpen, setIsMergeDrawerOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const resolvedAudienceCatalog = getCommunicationAudienceCatalog(audienceCatalog);
  const audienceOption = getCommunicationAudienceOption(draft.audience, resolvedAudienceCatalog);
  const recipientSummary = audienceRecipientSummaries.find((summary) => summary.audience === draft.audience);

  const handleSendTestEmail = async () => {
    if (!isExisting) {
      return;
    }
    setIsSendingTest(true);
    try {
      await onSendTestEmail(testEmail);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <section className="campaign-template-workspace" aria-label="Communication template builder">
      <div className="campaign-template-workspace__header">
        <div>
          <div className="campaign-studio__eyebrow">
            {isExisting ? 'Editing Template' : 'New Template'}
          </div>
          <h3 className="mb-1">{draft.name.trim() || 'Untitled communication template'}</h3>
          <div className="campaign-template-badge-row">
            <span className="campaign-template-badge">{getCommunicationAudienceLabel(draft.audience, resolvedAudienceCatalog)}</span>
            <span className={`campaign-template-badge ${draft.isActive ? '' : 'is-muted'}`}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="campaign-template-badge is-muted">
              {draft.bodyBlocks.length} blocks
            </span>
          </div>
        </div>
        <div className="campaign-template-workspace__header-actions">
          {isExisting ? (
            <label className="campaign-template-workspace__test-email">
              <span className="visually-hidden">Test email address</span>
              <input
                className="form-control form-control-sm"
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="Test email"
              />
            </label>
          ) : null}
          {isExisting ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={isSaving || isSendingTest}
              onClick={() => void handleSendTestEmail()}
            >
              <i className="bi bi-envelope-check" aria-hidden="true" />{' '}
              Send Test
            </button>
          ) : null}
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
      </div>

      <div className="campaign-template-workspace__tabs" role="tablist" aria-label="Template builder tabs">
        <button
          type="button"
          className={activeTab === 'metadata' ? 'is-active' : ''}
          onClick={() => onChangeTab('metadata')}
        >
          <i className="bi bi-sliders me-2" aria-hidden="true" />
          Metadata
        </button>
        <button
          type="button"
          className={activeTab === 'content' ? 'is-active' : ''}
          onClick={() => onChangeTab('content')}
        >
          <i className="bi bi-layout-text-window-reverse me-2" aria-hidden="true" />
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
            Intended Audience
            <select
              className="form-select"
              value={draft.audience}
              onChange={(event) =>
                onChangeDraft((currentDraft) => ({
                  ...currentDraft,
                  audience: event.target.value as CommunicationAudienceKey,
                }))
              }
            >
              {resolvedAudienceCatalog.map((audience) => (
                <option key={audience.key} value={audience.key}>
                  {audience.label}
                </option>
              ))}
            </select>
            <span className="campaign-template-workspace__field-help">
              {audienceOption.description} Exact recipients are resolved when this template is scheduled or sent.
            </span>
          </label>
          <div className="campaign-template-audience-summary campaign-studio__form-span-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold">Current Recipient Preview</div>
              <div className="campaign-template-audience-summary__count">
                {recipientSummary ? recipientSummary.count : 0} recipient{recipientSummary?.count === 1 ? '' : 's'}
              </div>
            </div>
            {recipientSummary && recipientSummary.sampleRecipients.length > 0 ? (
              <div className="campaign-template-audience-summary__samples">
                {recipientSummary.sampleRecipients.slice(0, 5).map((recipient) => (
                  <span key={`${recipient.email}:${recipient.displayName}`} className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-person-lines-fill" aria-hidden="true" />
                    <span>{recipient.displayName}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted small">No matching recipients are available for this audience yet.</span>
            )}
          </div>
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
          <div
            className={`campaign-template-workspace__editor-stage ${
              isMergeDrawerOpen ? 'is-merge-drawer-open' : ''
            }`}
          >
            <button
              type="button"
              className={`campaign-template-workspace__merge-edge-toggle ${
                isMergeDrawerOpen ? 'is-active' : ''
              }`}
              onClick={() => setIsMergeDrawerOpen((currentValue) => !currentValue)}
              aria-expanded={isMergeDrawerOpen}
            >
              <i className="bi bi-braces-asterisk" aria-hidden="true" />
              <span>{isMergeDrawerOpen ? 'Hide merge fields' : 'Show merge fields'}</span>
            </button>

            <CampaignStudioTemplateMergeFieldDrawer
              isOpen={isMergeDrawerOpen}
              onInsertMergeField={onInsertMergeField}
            />

            <div className="campaign-template-workspace__editor-column">
              <label className="form-label campaign-template-workspace__subject-field">
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
          </div>

          <CampaignStudioTemplatePreviewPanel
            subjectTemplate={draft.subjectTemplate}
            blocks={draft.bodyBlocks}
          />
        </div>
      )}
    </section>
  );
}
