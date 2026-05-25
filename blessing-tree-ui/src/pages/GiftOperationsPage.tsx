import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  createGiftLabelPrintJob,
  createGiftReminderRule,
  getCampaignGiftOperations,
  listGiftReminderRules,
  previewGiftReminderRule,
  sendGiftReminderRule,
  updateGiftReminderRule,
  updateCampaignGiftOperation,
} from '@/features/gifts/api/giftSearchApi';
import type {
  GiftLabelPrintJob,
  GiftOperationsAction,
  GiftOperationsItem,
  GiftOperationsResult,
  GiftReminderAudience,
  GiftReminderPreview,
  GiftReminderRule,
  GiftReminderRulesResult,
} from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { GiftTagPreview } from '@/features/gifts/ui/GiftTagPreview';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/gifts/ui/giftWorkflow.css';

const OPERATION_STATUSES = [
  'COMMITTED',
  'RECEIVED',
  'WRAPPED',
  'TAGGED',
  'READY_FOR_DISTRIBUTION',
  'DISTRIBUTED',
  'PICKED_UP',
  'EXCEPTION',
] as const;

const REMINDER_AUDIENCES: Array<{ value: GiftReminderAudience; label: string }> = [
  { value: 'SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS', label: 'Committed, not received' },
  { value: 'SPONSORS_WITH_OVERDUE_GIFTS', label: 'Overdue gifts' },
  { value: 'SPONSORS_WITH_RECEIVED_GIFTS', label: 'Received confirmations' },
];

const DEFAULT_REMINDER_FORM = {
  label: '',
  audience: 'SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS' as GiftReminderAudience,
  milestoneKey: '',
  offsetDays: 0,
  sendTimeLocal: '09:00',
  templateId: '',
  isEnabled: true,
  suppressIfAllReceived: true,
};

export function GiftOperationsPage() {
  const { campaignId = null } = useParams();
  const { campaigns, selectedCampaignId, selectCampaign } = useCampaigns();
  const [result, setResult] = useState<GiftOperationsResult | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedGift, setSelectedGift] = useState<GiftOperationsItem | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printJob, setPrintJob] = useState<GiftLabelPrintJob | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderResult, setReminderResult] = useState<GiftReminderRulesResult | null>(null);
  const [reminderForm, setReminderForm] = useState(DEFAULT_REMINDER_FORM);
  const [reminderPreview, setReminderPreview] = useState<GiftReminderPreview | null>(null);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  const loadOperations = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCampaignGiftOperations(campaignId, {
        status: statusFilter,
        search: appliedSearch,
      });
      setResult(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load gift operations.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, campaignId, statusFilter]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const loadReminders = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    try {
      const response = await listGiftReminderRules(campaignId);
      setReminderResult(response);
      setReminderForm((current) => ({
        ...current,
        milestoneKey: current.milestoneKey || response.milestoneOptions[0]?.milestoneKey || '',
        templateId: current.templateId || response.templateOptions[0]?.id || '',
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load gift reminder settings.');
    }
  }, [campaignId]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const items = result?.items ?? [];
  const selectedActions = useMemo(() => buildAvailableActions(selectedGift), [selectedGift]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchDraft.trim());
  }

  function openGift(item: GiftOperationsItem) {
    setSelectedGift(item);
    setActionNotes('');
    setMessage(null);
    setError(null);
  }

  async function handleAction(action: GiftOperationsAction, targetGift = selectedGift, notes = actionNotes) {
    if (!campaignId || !targetGift) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updatedGift = await updateCampaignGiftOperation(
        campaignId,
        targetGift.wishlistItemId,
        action,
        notes
      );
      setSelectedGift(updatedGift);
      setActionNotes('');
      setMessage(`${updatedGift.description} moved to ${toStatusLabel(updatedGift.status)}.`);
      await loadOperations();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update gift.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreatePrintJob(targetItems: GiftOperationsItem[]) {
    if (!campaignId || targetItems.length === 0) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const job = await createGiftLabelPrintJob(campaignId, {
        wishlistItemIds: targetItems.map((item) => item.wishlistItemId),
        copies: 1,
        format: 'TAG',
      });
      setPrintJob(job);
      setMessage(`${job.items.length} gift tag${job.items.length === 1 ? '' : 's'} queued for printing.`);
      await loadOperations();
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : 'Unable to create print job.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !reminderForm.label.trim()) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await createGiftReminderRule(campaignId, {
        label: reminderForm.label.trim(),
        audience: reminderForm.audience,
        milestoneKey: reminderForm.milestoneKey || null,
        offsetDays: reminderForm.offsetDays,
        sendTimeLocal: reminderForm.sendTimeLocal,
        templateId: reminderForm.templateId || null,
        isEnabled: reminderForm.isEnabled,
        suppressIfAllReceived: reminderForm.suppressIfAllReceived,
      });
      setReminderForm({
        ...DEFAULT_REMINDER_FORM,
        milestoneKey: reminderResult?.milestoneOptions[0]?.milestoneKey || '',
        templateId: reminderResult?.templateOptions[0]?.id || '',
      });
      setMessage('Gift reminder rule created.');
      await loadReminders();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create gift reminder rule.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleReminder(rule: GiftReminderRule) {
    if (!campaignId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateGiftReminderRule(campaignId, rule.id, { isEnabled: !rule.isEnabled });
      await loadReminders();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update reminder rule.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreviewReminder(rule: GiftReminderRule) {
    if (!campaignId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const preview = await previewGiftReminderRule(campaignId, rule.id);
      setReminderPreview(preview);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview reminder rule.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReminder(rule: GiftReminderRule) {
    if (!campaignId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await sendGiftReminderRule(campaignId, rule.id);
      setMessage(`Reminder processed: ${result.sentCount ?? 0} sent, ${result.skippedCount ?? 0} skipped.`);
      await loadReminders();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send reminder rule.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!campaignId) {
    return null;
  }

  return (
    <div className="campaign-studio-page gift-workflow-page">
      <div className="campaign-studio-page__header">
        <div>
          <div className="text-uppercase small text-muted fw-semibold mb-1">Gift Workflow</div>
          <h1 className="h3 mb-1">Gift Operations</h1>
          <p className="text-muted mb-0">
            {campaign?.name ?? 'Campaign'} receiving, wrapping, exception handling, and distribution readiness.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setRemindersOpen(true)}
          >
            <i className="bi bi-bell me-2" aria-hidden="true" />
            Reminder Settings
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={items.length === 0 || isSaving}
            onClick={() => void handleCreatePrintJob(items)}
          >
            <i className="bi bi-printer me-2" aria-hidden="true" />
            Print Visible Tags
          </button>
        </div>
      </div>

      <div className="campaign-studio__stat-grid campaign-team-stats">
        <StatCard label="Total In Process" value={countStatus(result, 'TOTAL')} />
        <StatCard label="Committed" value={countStatus(result, 'COMMITTED')} />
        <StatCard label="Received" value={countStatus(result, 'RECEIVED')} />
        <StatCard label="Wrapped" value={countStatus(result, 'WRAPPED')} />
        <StatCard label="Ready" value={countStatus(result, 'READY_FOR_DISTRIBUTION')} />
        <StatCard label="Exceptions" value={countStatus(result, 'EXCEPTION')} />
      </div>

      <section className="content-card">
        <form className="campaign-team-toolbar" onSubmit={handleSearch}>
          <label className="form-label campaign-team-toolbar__search mb-0">
            <span className="small text-uppercase text-muted fw-semibold">Search Gifts</span>
            <input
              className="form-control mt-2"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search gift description, category, or label code"
            />
          </label>
          <label className="form-label mb-0">
            <span className="small text-uppercase text-muted fw-semibold">Status</span>
            <select
              className="form-select mt-2"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {OPERATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {toStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-secondary" disabled={isLoading}>
            <i className="bi bi-search me-2" aria-hidden="true" />
            {isLoading ? 'Loading...' : 'Apply'}
          </button>
        </form>
      </section>

      {message ? <div className="alert alert-success" role="status">{message}</div> : null}
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

      <section className="campaign-team-workspace__section">
        <div className="campaign-team-workspace__section-header">
          <div>
            <h2 className="h5 mb-1">Operations Queue</h2>
            <p className="text-muted mb-0">
              Click a gift row to receive, wrap, mark ready, or flag an exception.
            </p>
          </div>
          <span className="text-muted small">{items.length} visible gift{items.length === 1 ? '' : 's'}</span>
        </div>

        {isLoading && !result ? (
          <p className="text-muted mb-0">Loading gift operations...</p>
        ) : items.length === 0 ? (
          <div className="campaign-studio__empty-note">No gifts match the current operations filter.</div>
        ) : (
          <div className="campaign-team-table-wrap">
            <table className="table campaign-team-table align-middle">
              <thead>
                <tr>
                  <th>Gift</th>
                  <th>Recipient</th>
                  <th>Sponsor</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <GiftOperationsRow
                    key={item.wishlistItemId}
                    item={item}
                    isSaving={isSaving}
                    onOpen={() => openGift(item)}
                    onAction={(action) => void handleAction(action, item, '')}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CampaignStudioDrawer
        isOpen={selectedGift !== null}
        title={selectedGift?.description ?? 'Gift'}
        description={selectedGift ? `${toStatusLabel(selectedGift.status)} workflow state` : undefined}
        onClose={() => setSelectedGift(null)}
        width="wide"
      >
        {selectedGift ? (
          <div className="campaign-team-drawer__stack">
            <section className="campaign-team-drawer__section">
              <div className="campaign-team-drawer__section-header">
                <div>
                  <h4 className="h6 mb-1">Workflow</h4>
                  <p className="text-muted mb-0">Current processing state and available next actions.</p>
                </div>
                <span className={`badge ${statusBadgeClass(selectedGift.status)}`}>
                  {toStatusLabel(selectedGift.status)}
                </span>
              </div>
              <div className="row g-3">
                <DrawerDetail label="Received" value={formatDateTime(selectedGift.receivedAt)} />
                <DrawerDetail label="Wrapped" value={formatDateTime(selectedGift.wrappedAt)} />
                <DrawerDetail label="Label" value={selectedGift.labelCode ?? 'Not assigned'} />
                <DrawerDetail label="Storage" value={selectedGift.storageLocationId ?? 'Not assigned'} />
              </div>
            </section>

            <section className="campaign-team-drawer__section">
              <div className="row g-3">
                <DrawerDetail
                  label="Recipient"
                  value={selectedGift.recipient?.displayLabel ?? selectedGift.recipient?.programRecipientId ?? 'Recipient'}
                />
                <DrawerDetail
                  label="Sponsor"
                  value={selectedGift.sponsor?.displayName ?? 'No sponsor linked'}
                />
                <DrawerDetail label="Sponsor Email" value={selectedGift.sponsor?.email ?? 'Not provided'} />
                <DrawerDetail label="Drop Off" value={toStatusLabel(selectedGift.sponsor?.dropOffStatus ?? 'UNKNOWN')} />
              </div>
            </section>

            <section className="campaign-team-drawer__section">
              <label className="form-label">
                Action Notes
                <textarea
                  className="form-control mt-2"
                  rows={3}
                  value={actionNotes}
                  onChange={(event) => setActionNotes(event.target.value)}
                  placeholder="Optional handling note"
                />
              </label>
              <div className="campaign-team-drawer__actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={isSaving}
                  onClick={() => void handleCreatePrintJob([selectedGift])}
                >
                  <i className="bi bi-printer me-2" aria-hidden="true" />
                  Print Tag
                </button>
                {selectedActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={action === 'exception' ? 'btn btn-outline-danger' : 'btn btn-secondary'}
                    disabled={isSaving}
                    onClick={() => void handleAction(action)}
                  >
                    <i className={`bi ${actionIcon(action)} me-2`} aria-hidden="true" />
                    {actionLabel(action)}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={printJob !== null}
        title="Gift Tag Print Queue"
        description={printJob ? `${printJob.items.length} tag${printJob.items.length === 1 ? '' : 's'} ready` : undefined}
        onClose={() => setPrintJob(null)}
        width="xwide"
      >
        {printJob ? (
          <div className="campaign-team-drawer__stack">
            <section className="campaign-team-drawer__section">
              <div className="campaign-team-drawer__section-header">
                <div>
                  <h4 className="h6 mb-1">Print Job</h4>
                  <p className="text-muted mb-0">Use the browser print command from this drawer for the current tag batch.</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <i className="bi bi-printer me-2" aria-hidden="true" />
                  Print
                </button>
              </div>
              <div className="row g-3">
                {printJob.items.map((item) => (
                  <div key={item.id} className="col-12 col-md-6 col-xl-4">
                    <GiftTagPreview item={item} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={remindersOpen}
        title="Gift Reminder Settings"
        description="Automated sponsor reminders for gift drop-off and receipt workflows."
        onClose={() => setRemindersOpen(false)}
        width="xwide"
      >
        <div className="campaign-team-drawer__stack">
          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">Reminder Rules</h4>
                <p className="text-muted mb-0">Rules use campaign milestones and sponsor email templates.</p>
              </div>
              <span className="text-muted small">{reminderResult?.rules.length ?? 0} configured</span>
            </div>
            {reminderResult?.rules.length ? (
              <div className="campaign-team-table-wrap">
                <table className="table campaign-team-table align-middle">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Audience</th>
                      <th>Timing</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminderResult.rules.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <strong>{rule.label}</strong>
                          <div className="text-muted small">{rule.ruleKey}</div>
                        </td>
                        <td>{audienceLabel(rule.audience)}</td>
                        <td>
                          <div>{timingLabel(rule)}</div>
                          <div className="text-muted small">Last checked {formatDateTime(rule.lastEvaluatedAt)}</div>
                        </td>
                        <td>{templateName(reminderResult, rule.templateId)}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${rule.isEnabled ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                            disabled={isSaving}
                            onClick={() => void handleToggleReminder(rule)}
                          >
                            <i className={`bi ${rule.isEnabled ? 'bi-toggle-on' : 'bi-toggle-off'} me-1`} aria-hidden="true" />
                            {rule.isEnabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isSaving}
                              onClick={() => void handlePreviewReminder(rule)}
                            >
                              <i className="bi bi-search me-1" aria-hidden="true" />
                              Preview
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={isSaving}
                              onClick={() => void handleSendReminder(rule)}
                            >
                              <i className="bi bi-send me-1" aria-hidden="true" />
                              Send
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="campaign-studio__empty-note">No gift reminder rules have been configured.</div>
            )}
          </section>

          {reminderPreview ? (
            <section className="campaign-team-drawer__section">
              <div className="campaign-team-drawer__section-header">
                <div>
                  <h4 className="h6 mb-1">Preview</h4>
                  <p className="text-muted mb-0">
                    {reminderPreview.recipientCount} sponsor{reminderPreview.recipientCount === 1 ? '' : 's'} currently match this rule.
                  </p>
                </div>
                <span className={`badge ${reminderPreview.isDue ? 'text-bg-success' : 'text-bg-secondary'}`}>
                  {reminderPreview.isDue ? 'Due' : 'Not due'}
                </span>
              </div>
              <div className="d-flex flex-column gap-3">
                {reminderPreview.recipients.map((recipient) => (
                  <div key={recipient.sponsorshipId} className="border rounded p-3">
                    <div className="d-flex align-items-start justify-content-between gap-3">
                      <div>
                        <strong>{recipient.sponsor.displayName}</strong>
                        <div className="text-muted small">{recipient.sponsor.email ?? 'No email'}</div>
                      </div>
                      <span className="badge text-bg-light">{recipient.giftCount} gift{recipient.giftCount === 1 ? '' : 's'}</span>
                    </div>
                    <div className="text-muted small mt-2">
                      {recipient.gifts.map((gift) => gift.description).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">New Rule</h4>
                <p className="text-muted mb-0">Create a reminder tied to a campaign milestone and email template.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleCreateReminder}>
              <label className="form-label col-12 col-lg-6">
                Rule Label
                <input
                  className="form-control mt-2"
                  value={reminderForm.label}
                  onChange={(event) => setReminderForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Gift drop-off reminder"
                />
              </label>
              <label className="form-label col-12 col-lg-6">
                Audience
                <select
                  className="form-select mt-2"
                  value={reminderForm.audience}
                  onChange={(event) => setReminderForm((current) => ({ ...current, audience: event.target.value as GiftReminderAudience }))}
                >
                  {REMINDER_AUDIENCES.map((audience) => (
                    <option key={audience.value} value={audience.value}>{audience.label}</option>
                  ))}
                </select>
              </label>
              <label className="form-label col-12 col-lg-6">
                Milestone
                <select
                  className="form-select mt-2"
                  value={reminderForm.milestoneKey}
                  onChange={(event) => setReminderForm((current) => ({ ...current, milestoneKey: event.target.value }))}
                >
                  <option value="">No milestone</option>
                  {reminderResult?.milestoneOptions.map((milestone) => (
                    <option key={milestone.milestoneKey} value={milestone.milestoneKey}>
                      {milestone.label} ({formatDate(milestone.occursOn)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label col-6 col-lg-3">
                Offset Days
                <input
                  type="number"
                  className="form-control mt-2"
                  value={reminderForm.offsetDays}
                  onChange={(event) => setReminderForm((current) => ({ ...current, offsetDays: Number(event.target.value) }))}
                />
              </label>
              <label className="form-label col-6 col-lg-3">
                Send Time
                <input
                  type="time"
                  className="form-control mt-2"
                  value={reminderForm.sendTimeLocal}
                  onChange={(event) => setReminderForm((current) => ({ ...current, sendTimeLocal: event.target.value }))}
                />
              </label>
              <label className="form-label col-12 col-lg-8">
                Template
                <select
                  className="form-select mt-2"
                  value={reminderForm.templateId}
                  onChange={(event) => setReminderForm((current) => ({ ...current, templateId: event.target.value }))}
                >
                  <option value="">No template selected</option>
                  {reminderResult?.templateOptions.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>
              <div className="col-12 col-lg-4 d-flex align-items-end gap-3">
                <label className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={reminderForm.isEnabled}
                    onChange={(event) => setReminderForm((current) => ({ ...current, isEnabled: event.target.checked }))}
                  />
                  <span className="form-check-label">Enabled</span>
                </label>
                <label className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={reminderForm.suppressIfAllReceived}
                    onChange={(event) => setReminderForm((current) => ({ ...current, suppressIfAllReceived: event.target.checked }))}
                  />
                  <span className="form-check-label">Suppress received</span>
                </label>
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-secondary" disabled={isSaving || !reminderForm.label.trim()}>
                  <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                  Create Rule
                </button>
              </div>
            </form>
          </section>
        </div>
      </CampaignStudioDrawer>
    </div>
  );
}

function GiftOperationsRow({
  item,
  isSaving,
  onOpen,
  onAction,
}: {
  item: GiftOperationsItem;
  isSaving: boolean;
  onOpen: () => void;
  onAction: (action: GiftOperationsAction) => void;
}) {
  const actions = buildAvailableActions(item);

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <tr
      className="campaign-team-table__row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <td>
        <strong>{item.description}</strong>
        <div className="text-muted small">
          {item.category ?? item.itemType}{item.size ? ` · ${item.size}` : ''}
        </div>
      </td>
      <td>
        {item.recipient?.displayLabel ?? 'Recipient'}
        <div className="text-muted small">{item.recipient?.programRecipientId ?? item.recipient?.recipientKind ?? ''}</div>
      </td>
      <td>
        {item.sponsor?.displayName ?? 'Unassigned'}
        <div className="text-muted small">{item.sponsor?.email ?? item.sponsor?.phone ?? ''}</div>
      </td>
      <td>
        <span className={`badge ${statusBadgeClass(item.status)}`}>{toStatusLabel(item.status)}</span>
      </td>
      <td>
        <div className="text-muted small">Received {formatDateTime(item.receivedAt)}</div>
        <div className="text-muted small">Wrapped {formatDateTime(item.wrappedAt)}</div>
      </td>
      <td>
        <div className="d-flex flex-wrap gap-2">
          {actions.slice(0, 2).map((action) => (
            <button
              key={action}
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={isSaving}
              onClick={(event) => {
                event.stopPropagation();
                onAction(action);
              }}
            >
              <i className={`bi ${actionIcon(action)} me-1`} aria-hidden="true" />
              {actionLabel(action)}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="campaign-studio__stat-card">
      <span className="campaign-studio__stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DrawerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-12 col-md-6">
      <div className="small text-uppercase text-muted fw-semibold">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function buildAvailableActions(item: GiftOperationsItem | null): GiftOperationsAction[] {
  if (!item) {
    return [];
  }
  const actions: GiftOperationsAction[] = [];
  if (item.status === 'COMMITTED' || item.status === 'EXCEPTION') {
    actions.push('receive');
  }
  if (item.status === 'RECEIVED' || item.status === 'EXCEPTION') {
    actions.push('wrap');
  }
  if (item.status === 'WRAPPED' || item.status === 'TAGGED' || item.status === 'EXCEPTION') {
    actions.push('ready');
  }
  if (item.status === 'READY_FOR_DISTRIBUTION' || item.status === 'DISTRIBUTED' || item.status === 'EXCEPTION') {
    actions.push('pickup');
  }
  if (!['DISTRIBUTED', 'PICKED_UP', 'CANCELLED'].includes(item.status)) {
    actions.push('exception');
  }
  return actions;
}

function countStatus(result: GiftOperationsResult | null, status: string): number {
  return result?.counts[status] ?? 0;
}

function toStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not set';
  }
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'EXCEPTION') {
    return 'text-bg-danger';
  }
  if (status === 'READY_FOR_DISTRIBUTION' || status === 'DISTRIBUTED' || status === 'PICKED_UP') {
    return 'text-bg-success';
  }
  if (status === 'RECEIVED' || status === 'WRAPPED' || status === 'TAGGED') {
    return 'text-bg-info';
  }
  return 'text-bg-secondary';
}

function actionLabel(action: GiftOperationsAction): string {
  if (action === 'receive') return 'Receive';
  if (action === 'wrap') return 'Wrap';
  if (action === 'ready') return 'Mark Ready';
  if (action === 'pickup') return 'Mark Picked Up';
  return 'Exception';
}

function actionIcon(action: GiftOperationsAction): string {
  if (action === 'receive') return 'bi-box-arrow-in-down';
  if (action === 'wrap') return 'bi-gift';
  if (action === 'ready') return 'bi-check2-circle';
  if (action === 'pickup') return 'bi-person-check';
  return 'bi-exclamation-triangle';
}

function audienceLabel(audience: GiftReminderAudience): string {
  return REMINDER_AUDIENCES.find((item) => item.value === audience)?.label ?? toStatusLabel(audience);
}

function timingLabel(rule: GiftReminderRule): string {
  const offset = rule.offsetDays === 0 ? 'on' : `${Math.abs(rule.offsetDays)} day${Math.abs(rule.offsetDays) === 1 ? '' : 's'} ${rule.offsetDays < 0 ? 'before' : 'after'}`;
  return `${offset} ${rule.milestoneKey ?? 'manual schedule'} at ${rule.sendTimeLocal}`;
}

function templateName(result: GiftReminderRulesResult, templateId: string | null): string {
  if (!templateId) {
    return 'No template';
  }
  return result.templateOptions.find((template) => template.id === templateId)?.name ?? 'Template unavailable';
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
