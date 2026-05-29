import { startTransition, useEffect, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioCommunications.css';
import {
  createBlankCommunicationTemplateDraft,
  deriveTemplateKey,
  draftFromCommunicationTemplate,
  insertMergeFieldIntoDraft,
  toCreateTemplateInput,
  toUpdateTemplateInput,
  type CommunicationTemplateDraft,
  type CommunicationTemplateFocusTarget,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import type {
  CommunicationAudienceOption,
  CommunicationAudienceRecipientSummary,
  CommunicationRecipientOption,
  CommunicationRecipientOptions,
  CommunicationSendTargetMode,
  CommunicationSendHistoryItem,
  CommunicationTemplate,
  CreateCommunicationSendInput,
  CreateCommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
  CommunicationTemplateTestEmailResult,
} from '@/features/campaigns/model/campaignStudioTypes';
import { audienceLabelForSummary } from '@/features/campaigns/model/campaignAudienceSummary';
import { CampaignAudienceRecipientDrawer } from '@/features/campaigns/ui/CampaignAudienceRecipientDrawer';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import { CampaignStudioTemplateLibrary } from '@/features/campaigns/ui/CampaignStudioTemplateLibrary';
import { CampaignStudioTemplateWorkspace } from '@/features/campaigns/ui/CampaignStudioTemplateWorkspace';

interface CampaignStudioCommunicationsSectionProps {
  audienceCatalog: CommunicationAudienceOption[];
  audienceRecipientSummaries?: CommunicationAudienceRecipientSummary[];
  recipientOptions?: CommunicationRecipientOptions;
  sends?: CommunicationSendHistoryItem[];
  templates: CommunicationTemplate[];
  isSaving: boolean;
  requestedTemplateId?: string | null;
  onConsumeRequestedTemplate?: () => void;
  onCreateTemplate: (
    input: CreateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onUpdateTemplate: (
    templateId: string,
    input: UpdateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onDeleteTemplate: (templateId: string) => Promise<boolean>;
  onSendTestEmail?: (
    templateId: string,
    recipientEmail?: string
  ) => Promise<CommunicationTemplateTestEmailResult | null>;
  onSendCommunication?: (input: CreateCommunicationSendInput) => Promise<boolean>;
}

export function CampaignStudioCommunicationsSection({
  audienceCatalog,
  audienceRecipientSummaries = [],
  recipientOptions = EMPTY_RECIPIENT_OPTIONS,
  sends = [],
  templates,
  isSaving,
  requestedTemplateId = null,
  onConsumeRequestedTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onSendTestEmail,
  onSendCommunication,
}: CampaignStudioCommunicationsSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id ?? null
  );
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'metadata' | 'content'>('metadata');
  const [focusedTarget, setFocusedTarget] = useState<CommunicationTemplateFocusTarget>({
    kind: 'subject',
  });
  const [draft, setDraft] = useState<CommunicationTemplateDraft>(() =>
    templates[0]
      ? draftFromCommunicationTemplate(templates[0])
      : createBlankCommunicationTemplateDraft()
  );

  useEffect(() => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (selectedTemplateId && !selectedTemplate) {
      const nextTemplate = templates[0] ?? null;
      startTransition(() => {
        setSelectedTemplateId(nextTemplate?.id ?? null);
        setActiveTab(nextTemplate ? 'metadata' : 'content');
        setDraft(
          nextTemplate
            ? draftFromCommunicationTemplate(nextTemplate)
            : createBlankCommunicationTemplateDraft()
        );
      });
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!requestedTemplateId) {
      return;
    }

    const requestedTemplate = templates.find((template) => template.id === requestedTemplateId);
    if (!requestedTemplate) {
      return;
    }

    startTransition(() => {
      setSelectedTemplateId(requestedTemplate.id);
      setDraft(draftFromCommunicationTemplate(requestedTemplate));
      setActiveTab('metadata');
      onConsumeRequestedTemplate?.();
    });
  }, [onConsumeRequestedTemplate, requestedTemplateId, templates]);

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setActiveTab('metadata');
    setIsLibraryCollapsed(true);
    setDraft(createBlankCommunicationTemplateDraft());
  };

  const handleSave = async () => {
    const savedTemplate = selectedTemplateId
      ? await onUpdateTemplate(selectedTemplateId, toUpdateTemplateInput(draft))
      : await onCreateTemplate(toCreateTemplateInput(draft));

    if (!savedTemplate) {
      return;
    }

    setSelectedTemplateId(savedTemplate.id);
    setDraft(draftFromCommunicationTemplate(savedTemplate));
    setActiveTab('content');
  };

  const handleInsertMergeField = (field: string) => {
    setDraft((currentDraft) =>
      insertMergeFieldIntoDraft(currentDraft, focusedTarget, field)
    );
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Communications"
        title="Email Template Builder"
        description="Build reusable campaign email templates here. Communication timing now lives only in the campaign calendar and scheduler."
      >
        <div className="campaign-template-builder">
          <CampaignStudioTemplateLibrary
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            isPanelOpen={!isLibraryCollapsed}
            onSelectTemplate={(templateId) => {
              const selectedTemplate = templates.find((template) => template.id === templateId);
              setSelectedTemplateId(templateId);
              setActiveTab('metadata');
              setIsLibraryCollapsed(false);
              if (selectedTemplate) {
                setDraft(draftFromCommunicationTemplate(selectedTemplate));
              }
            }}
            onCreateNew={handleCreateNew}
            onDeleteTemplate={async (templateId) => {
              const currentIndex = templates.findIndex((template) => template.id === templateId);
              const fallbackTemplate =
                templates[currentIndex + 1] ?? templates[currentIndex - 1] ?? null;

              const deleted = await onDeleteTemplate(templateId);
              if (!deleted) {
                return false;
              }

              if (templateId === selectedTemplateId) {
                setSelectedTemplateId(fallbackTemplate?.id ?? null);
                setDraft(
                  fallbackTemplate
                    ? draftFromCommunicationTemplate(fallbackTemplate)
                    : createBlankCommunicationTemplateDraft()
                );
                setActiveTab(fallbackTemplate ? 'metadata' : 'content');
              }

              return true;
            }}
            onTogglePanel={() => setIsLibraryCollapsed((currentValue) => !currentValue)}
          />

          <CampaignStudioTemplateWorkspace
            draft={draft}
            audienceCatalog={audienceCatalog}
            audienceRecipientSummaries={audienceRecipientSummaries}
            activeTab={activeTab}
            isSaving={isSaving}
            isExisting={selectedTemplateId !== null}
            onChangeTab={setActiveTab}
            onChangeDraft={(updater) =>
              setDraft((currentDraft) => {
                const nextDraft = updater(currentDraft);
                const currentDerivedKey = deriveTemplateKey(currentDraft.name);
                const shouldAutoDeriveKey =
                  !selectedTemplateId &&
                  nextDraft.name &&
                  (
                    !currentDraft.templateKey.trim() ||
                    currentDraft.templateKey.trim() === currentDerivedKey
                  );

                if (shouldAutoDeriveKey) {
                  return {
                    ...nextDraft,
                    templateKey: deriveTemplateKey(nextDraft.name),
                  };
                }
                return nextDraft;
              })
            }
            onSave={handleSave}
            onSendTestEmail={(recipientEmail) =>
              selectedTemplateId && onSendTestEmail
                ? onSendTestEmail(selectedTemplateId, recipientEmail)
                : Promise.resolve(null)
            }
            onInsertMergeField={handleInsertMergeField}
            onFocusTarget={setFocusedTarget}
          />
        </div>
      </CampaignStudioSectionCard>

      <CampaignCommunicationSendNowPanel
        templates={templates}
        audienceCatalog={audienceCatalog}
        audienceRecipientSummaries={audienceRecipientSummaries}
        recipientOptions={recipientOptions}
        isSaving={isSaving}
        onSendCommunication={onSendCommunication}
      />

      <CampaignCommunicationHistoryPanel sends={sends} />
    </div>
  );
}

function CampaignCommunicationSendNowPanel({
  templates,
  audienceCatalog,
  audienceRecipientSummaries,
  recipientOptions,
  isSaving,
  onSendCommunication,
}: {
  templates: CommunicationTemplate[];
  audienceCatalog: CommunicationAudienceOption[];
  audienceRecipientSummaries: CommunicationAudienceRecipientSummary[];
  recipientOptions: CommunicationRecipientOptions;
  isSaving: boolean;
  onSendCommunication?: (input: CreateCommunicationSendInput) => Promise<boolean>;
}) {
  const activeTemplates = templates.filter((template) => template.isActive && template.channel === 'EMAIL');
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id ?? '');
  const [targetMode, setTargetMode] = useState<CommunicationSendTargetMode>('AUDIENCE');
  const [manualEmails, setManualEmails] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedSponsorIds, setSelectedSponsorIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isAudienceRecipientDrawerOpen, setIsAudienceRecipientDrawerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const effectiveTemplateId = templateId || activeTemplates[0]?.id || '';
  const selectedTemplate = activeTemplates.find((template) => template.id === effectiveTemplateId) ?? null;
  const audienceOption = selectedTemplate
    ? audienceCatalog.find((option) => option.key === selectedTemplate.audience)
    : null;
  const recipientSummary = selectedTemplate
    ? audienceRecipientSummaries.find((summary) => summary.audience === selectedTemplate.audience)
    : null;
  const manualRecipients = parseManualRecipients(manualEmails);
  const recipientCount = countSelectedRecipients({
    targetMode,
    recipientSummaryCount: recipientSummary?.count ?? 0,
    manualRecipientCount: manualRecipients.length,
    recipientOptions,
    selectedTeamIds,
    selectedSponsorIds,
    selectedMemberIds,
    selectedContactIds,
  });

  const handleSend = async () => {
    setLocalError(null);
    if (!selectedTemplate) {
      setLocalError('Choose an active email template before sending.');
      return;
    }
    if (recipientCount === 0) {
      setLocalError('At least one recipient is required before sending.');
      return;
    }
    const didSend = await onSendCommunication?.({
      templateId: selectedTemplate.id,
      targetMode,
      manualRecipients: targetMode === 'MANUAL_EMAIL' ? manualRecipients : [],
      teamIds: targetMode === 'TEAM' ? selectedTeamIds : [],
      sponsorIds: targetMode === 'SELECTED_SPONSORS' ? selectedSponsorIds : [],
      memberIds: targetMode === 'SELECTED_MEMBERS' ? selectedMemberIds : [],
      contactIds: targetMode === 'SELECTED_CONTACTS' ? selectedContactIds : [],
    });
    if (!didSend) {
      setLocalError('Unable to send this communication.');
    } else {
      setManualEmails('');
      setSelectedTeamIds([]);
      setSelectedSponsorIds([]);
      setSelectedMemberIds([]);
      setSelectedContactIds([]);
      setTargetMode('AUDIENCE');
    }
  };

  return (
    <CampaignStudioSectionCard
      eyebrow="Send"
      title="Send Now"
      description="Choose the exact recipients for a real campaign email. Sends are recorded in history."
    >
      {localError ? <div className="alert alert-danger">{localError}</div> : null}
      <div className="campaign-template-send-now">
        <label className="form-label">
          Template
          <select
            className="form-select"
            value={effectiveTemplateId}
            onChange={(event) => {
              setTemplateId(event.target.value);
              setLocalError(null);
            }}
          >
            <option value="">Choose an active template</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-label">
          To
          <select
            className="form-select"
            value={targetMode}
            onChange={(event) => {
              setTargetMode(event.target.value as CommunicationSendTargetMode);
              setLocalError(null);
              setSelectedTeamIds([]);
              setSelectedSponsorIds([]);
              setSelectedMemberIds([]);
              setSelectedContactIds([]);
            }}
          >
            <option value="AUDIENCE">All intended audience recipients</option>
            <option value="TEAM">Campaign team</option>
            <option value="SELECTED_SPONSORS">Selected sponsors</option>
            <option value="SELECTED_MEMBERS">Selected campaign members</option>
            <option value="SELECTED_CONTACTS">Selected group contacts</option>
            <option value="MANUAL_EMAIL">Manual email addresses</option>
          </select>
        </label>

        <div className="campaign-template-send-now__summary">
          <div>
            <div className="small text-uppercase text-muted fw-semibold">Recipients</div>
            <div className="campaign-template-send-now__count">
              {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
            </div>
            <div className="text-muted small">
              {targetMode === 'AUDIENCE'
                ? `Uses ${audienceOption?.label ?? selectedTemplate?.audience ?? 'the template audience'}.`
                : targetMode === 'MANUAL_EMAIL'
                  ? 'Uses the manual addresses entered below.'
                  : 'Uses the selected recipients below. Duplicate email addresses are only sent once.'}
            </div>
          </div>
          {targetMode === 'AUDIENCE' && recipientSummary?.sampleRecipients.length ? (
            <div className="campaign-template-send-now__samples">
              {recipientSummary.sampleRecipients.slice(0, 5).map((recipient) => (
                <span key={`${recipient.email}:${recipient.displayName}`} className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-person-lines-fill" aria-hidden="true" />
                  <span>{recipient.displayName}</span>
                </span>
              ))}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setIsAudienceRecipientDrawerOpen(true)}
              >
                <i className="bi bi-people me-2" aria-hidden="true" />
                View recipients
              </button>
            </div>
          ) : null}
          {isAudienceRecipientDrawerOpen ? (
            <CampaignAudienceRecipientDrawer
              audienceLabel={audienceLabelForSummary(
                audienceCatalog,
                recipientSummary ?? null,
                selectedTemplate?.audience ?? null
              )}
              summary={recipientSummary ?? null}
              onClose={() => setIsAudienceRecipientDrawerOpen(false)}
            />
          ) : null}
        </div>

        {targetMode === 'MANUAL_EMAIL' ? (
          <label className="form-label campaign-template-send-now__manual">
            Manual Recipients
            <textarea
              className="form-control"
              rows={4}
              value={manualEmails}
              onChange={(event) => {
                setManualEmails(event.target.value);
                setLocalError(null);
              }}
              placeholder="one@example.org&#10;Pat Coordinator <pat@example.org>"
            />
            <span className="campaign-template-workspace__field-help">
              Enter one recipient per line. Names are optional.
            </span>
          </label>
        ) : null}

        {targetMode === 'TEAM' ? (
          <CommunicationRecipientPicker
            title="Teams"
            emptyText="No active teams with reachable members are available."
            options={recipientOptions.teams}
            selectedIds={selectedTeamIds}
            onChange={setSelectedTeamIds}
          />
        ) : null}

        {targetMode === 'SELECTED_SPONSORS' ? (
          <CommunicationRecipientPicker
            title="Sponsors"
            emptyText="No active sponsors with email addresses are available."
            options={recipientOptions.sponsors}
            selectedIds={selectedSponsorIds}
            onChange={setSelectedSponsorIds}
          />
        ) : null}

        {targetMode === 'SELECTED_MEMBERS' ? (
          <CommunicationRecipientPicker
            title="Campaign Members"
            emptyText="No active campaign members with email addresses are available."
            options={recipientOptions.members}
            selectedIds={selectedMemberIds}
            onChange={setSelectedMemberIds}
          />
        ) : null}

        {targetMode === 'SELECTED_CONTACTS' ? (
          <CommunicationRecipientPicker
            title="Group Contacts"
            emptyText="No group contacts with email addresses are available."
            options={recipientOptions.contacts}
            selectedIds={selectedContactIds}
            onChange={setSelectedContactIds}
          />
        ) : null}

        <div className="campaign-template-send-now__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isSaving || !onSendCommunication || !selectedTemplate || recipientCount === 0}
            onClick={() => void handleSend()}
          >
            <i className={`bi ${isSaving ? 'bi-arrow-repeat' : 'bi-send'} me-2`} aria-hidden="true" />
            Send Now
          </button>
        </div>
      </div>
    </CampaignStudioSectionCard>
  );
}

function CommunicationRecipientPicker({
  title,
  emptyText,
  options,
  selectedIds,
  onChange,
}: {
  title: string;
  emptyText: string;
  options: CommunicationRecipientOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}) {
  return (
    <div className="campaign-template-send-now__picker">
      <div className="campaign-template-send-now__picker-header">
        <div>
          <div className="small text-uppercase text-muted fw-semibold">{title}</div>
          <div className="campaign-template-send-now__picker-count">
            {selectedIds.length} selected
          </div>
        </div>
        {options.length > 0 ? (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              onChange(selectedIds.length === options.length ? [] : options.map((option) => option.id));
            }}
          >
            {selectedIds.length === options.length ? 'Clear' : 'Select all'}
          </button>
        ) : null}
      </div>

      {options.length === 0 ? (
        <div className="campaign-studio__empty-note mb-0">{emptyText}</div>
      ) : (
        <div className="campaign-template-send-now__picker-list">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <label key={option.id} className="campaign-template-send-now__picker-option">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selectedIds, option.id]);
                    } else {
                      onChange(selectedIds.filter((selectedId) => selectedId !== option.id));
                    }
                  }}
                />
                <span>
                  <span className="campaign-template-send-now__picker-name">{option.label}</span>
                  <span className="campaign-template-send-now__picker-meta">
                    {[option.email, option.description].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignCommunicationHistoryPanel({ sends }: { sends: CommunicationSendHistoryItem[] }) {
  const [selectedSend, setSelectedSend] = useState<CommunicationSendHistoryItem | null>(null);

  return (
    <CampaignStudioSectionCard
      eyebrow="History"
      title="Recent Communication Sends"
      description="Real sends are recorded here so campaign managers can see what went out and whether it reached recipients."
    >
      {sends.length === 0 ? (
        <div className="campaign-studio__empty-note mb-0">
          No real campaign communications have been sent yet. Test emails do not appear here.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table campaign-team-table align-middle">
            <thead>
              <tr>
                <th scope="col">Sent</th>
                <th scope="col">Template</th>
                <th scope="col">Subject</th>
                <th scope="col">Target</th>
                <th scope="col">Delivery</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((send) => (
                <tr
                  key={send.id}
                  className="campaign-template-history__row"
                  tabIndex={0}
                  onClick={() => setSelectedSend(send)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedSend(send);
                    }
                  }}
                >
                  <td>{formatCommunicationDate(send.createdAt)}</td>
                  <td>{send.templateName}</td>
                  <td>{send.subject}</td>
                  <td>{formatTargetMode(send.targetMode)}</td>
                  <td>
                    <span className={`campaign-template-badge ${send.status === 'SENT' ? '' : 'is-muted'}`}>
                      {send.deliveredCount}/{send.recipientCount} {send.status.toLowerCase()}
                    </span>
                    {send.failedCount > 0 ? (
                      <div className="campaign-template-history__error">
                        {send.failedCount} failed{send.errorMessage ? `: ${send.errorMessage}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td>{send.createdByDisplayName ?? 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedSend ? (
        <CampaignCommunicationHistoryDrawer
          send={selectedSend}
          onClose={() => setSelectedSend(null)}
        />
      ) : null}
    </CampaignStudioSectionCard>
  );
}

function CampaignCommunicationHistoryDrawer({
  send,
  onClose,
}: {
  send: CommunicationSendHistoryItem;
  onClose: () => void;
}) {
  return (
    <div className="campaign-template-history-drawer" role="dialog" aria-modal="true" aria-label="Communication send details">
      <div className="campaign-template-history-drawer__backdrop" onClick={onClose} />
      <aside className="campaign-template-history-drawer__panel">
        <div className="campaign-template-history-drawer__header">
          <div>
            <div className="small text-uppercase text-muted fw-semibold">Communication Send</div>
            <h3 className="h5 mb-1">{send.templateName}</h3>
            <div className="text-muted small">{formatCommunicationDate(send.createdAt)}</div>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
          >
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="campaign-template-history-drawer__summary">
          <div>
            <span className="campaign-template-history-drawer__label">Subject</span>
            <strong>{send.subject}</strong>
          </div>
          <div>
            <span className="campaign-template-history-drawer__label">Target</span>
            <strong>{formatTargetMode(send.targetMode)}</strong>
          </div>
          <div>
            <span className="campaign-template-history-drawer__label">Delivery</span>
            <strong>{send.deliveredCount}/{send.recipientCount} {send.status.toLowerCase()}</strong>
          </div>
          <div>
            <span className="campaign-template-history-drawer__label">Sent by</span>
            <strong>{send.createdByDisplayName ?? 'System'}</strong>
          </div>
        </div>

        {send.errorMessage ? (
          <div className="alert alert-danger py-2">{send.errorMessage}</div>
        ) : null}

        <div className="campaign-template-history-drawer__recipient-header">
          <div>
            <div className="small text-uppercase text-muted fw-semibold">Recipients</div>
            <div className="campaign-template-history-drawer__recipient-count">
              {send.recipients.length} recorded
            </div>
          </div>
        </div>

        {send.recipients.length === 0 ? (
          <div className="campaign-studio__empty-note mb-0">
            No recipient-level rows were recorded for this send.
          </div>
        ) : (
          <div className="campaign-template-history-drawer__recipient-list">
            {send.recipients.map((recipient) => (
              <div key={recipient.id} className="campaign-template-history-drawer__recipient">
                <div>
                  <strong>{recipient.displayName ?? recipient.email}</strong>
                  <div className="text-muted small">{recipient.email}</div>
                  {recipient.errorMessage ? (
                    <div className="campaign-template-history__error">{recipient.errorMessage}</div>
                  ) : null}
                </div>
                <div className="campaign-template-history-drawer__recipient-status">
                  <span className={`campaign-template-badge ${recipient.status === 'SENT' ? '' : 'is-muted'}`}>
                    {recipient.status.toLowerCase()}
                  </span>
                  <span className="text-muted small">{formatTargetMode(recipient.recipientType)}</span>
                  {recipient.sentAt ? (
                    <span className="text-muted small">{formatCommunicationDate(recipient.sentAt)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function formatTargetMode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCommunicationDate(value: string | null): string {
  if (!value) {
    return 'Not recorded';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not recorded';
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseManualRecipients(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*?)<([^>]+)>$/);
      if (match) {
        return {
          displayName: match[1].trim() || null,
          email: match[2].trim(),
        };
      }
      return {
        displayName: null,
        email: entry,
      };
    })
    .filter((recipient, index, recipients) => (
      recipient.email.includes('@') &&
      recipients.findIndex((candidate) => candidate.email.toLowerCase() === recipient.email.toLowerCase()) === index
    ));
}

function countSelectedRecipients({
  targetMode,
  recipientSummaryCount,
  manualRecipientCount,
  recipientOptions,
  selectedTeamIds,
  selectedSponsorIds,
  selectedMemberIds,
  selectedContactIds,
}: {
  targetMode: CommunicationSendTargetMode;
  recipientSummaryCount: number;
  manualRecipientCount: number;
  recipientOptions: CommunicationRecipientOptions;
  selectedTeamIds: string[];
  selectedSponsorIds: string[];
  selectedMemberIds: string[];
  selectedContactIds: string[];
}): number {
  if (targetMode === 'AUDIENCE') {
    return recipientSummaryCount;
  }
  if (targetMode === 'MANUAL_EMAIL') {
    return manualRecipientCount;
  }
  if (targetMode === 'TEAM') {
    return recipientOptions.teams
      .filter((option) => selectedTeamIds.includes(option.id))
      .reduce((sum, option) => sum + (option.memberCount ?? 0), 0);
  }
  if (targetMode === 'SELECTED_SPONSORS') {
    return selectedSponsorIds.length;
  }
  if (targetMode === 'SELECTED_MEMBERS') {
    return selectedMemberIds.length;
  }
  if (targetMode === 'SELECTED_CONTACTS') {
    return selectedContactIds.length;
  }
  return 0;
}

const EMPTY_RECIPIENT_OPTIONS: CommunicationRecipientOptions = {
  teams: [],
  sponsors: [],
  members: [],
  contacts: [],
};
