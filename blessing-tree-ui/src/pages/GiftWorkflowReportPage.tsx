import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buildCampaignGiftsOperationsPath,
  buildCampaignGiftsSearchPath,
} from '@/app/routes';
import { getCampaignSponsorWorkspace } from '@/features/campaigns/api/campaignSponsorWorkspaceApi';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { getGiftWorkflowReport } from '@/features/gifts/api/giftReportApi';
import {
  commitCampaignGift,
  createGiftLabelPrintJob,
  updateGiftScanAction,
  updateCampaignGiftOperation,
} from '@/features/gifts/api/giftSearchApi';
import type {
  GiftWorkflowReport,
  GiftWorkflowReportGift,
  GiftWorkflowReportRecipient,
  GiftWorkflowStatus,
} from '@/features/gifts/model/giftReportTypes';
import type {
  GiftLabelPrintJob,
  GiftOperationsAction,
} from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { GiftTagPreview } from '@/features/gifts/ui/GiftTagPreview';
import '@/features/gifts/ui/giftWorkflow.css';
import '@/features/gifts/ui/giftWorkflowReport.css';

const DISPLAY_STEPS: GiftWorkflowStatus[] = [
  'OPEN',
  'RESERVED',
  'COMMITTED',
  'RECEIVED',
  'WRAPPED',
  'TAGGED',
  'READY_FOR_DISTRIBUTION',
  'DISTRIBUTED',
  'PICKED_UP',
];

const STATUS_COLORS: Record<GiftWorkflowStatus, string> = {
  OPEN: '#7a756f',
  RESERVED: '#8a6f35',
  COMMITTED: '#7b5bb7',
  RECEIVED: '#1f7a8c',
  WRAPPED: '#2f855a',
  TAGGED: '#2b6cb0',
  READY_FOR_DISTRIBUTION: '#3182ce',
  DISTRIBUTED: '#2f6f4e',
  PICKED_UP: '#246b45',
  EXCEPTION: '#b83232',
  CANCELLED: '#6b7280',
};

const GIFT_STATUS_REFRESH_INTERVAL_MS = 5000;

export function GiftWorkflowReportPage() {
  const { campaignId = null } = useParams();
  const { selectedCampaignId, selectCampaign } = useCampaigns();
  const [report, setReport] = useState<GiftWorkflowReport | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sponsors, setSponsors] = useState<CampaignSponsor[]>([]);
  const [selectedGift, setSelectedGift] = useState<{
    gift: GiftWorkflowReportGift;
    recipient: GiftWorkflowReportRecipient;
  } | null>(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [printJob, setPrintJob] = useState<GiftLabelPrintJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportRefreshInFlightRef = useRef(false);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  const loadReport = useCallback(async (options: { background?: boolean } = {}) => {
    if (!campaignId) {
      return null;
    }
    if (reportRefreshInFlightRef.current) {
      return null;
    }
    reportRefreshInFlightRef.current = true;
    const isBackground = options.background === true;
    if (isBackground) {
      setIsAutoRefreshing(true);
    } else {
      setIsLoading(true);
      setError(null);
    }
    try {
      const response = await getGiftWorkflowReport(campaignId);
      setReport(response);
      setLastRefreshedAt(new Date());
      return response;
    } catch (loadError) {
      if (!isBackground) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load gift workflow report.');
      }
      return null;
    } finally {
      if (isBackground) {
        setIsAutoRefreshing(false);
      } else {
        setIsLoading(false);
      }
      reportRefreshInFlightRef.current = false;
    }
  }, [campaignId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!campaignId || selectedGift !== null || printJob !== null || isSaving) {
      return;
    }

    let cancelled = false;
    const refreshVisibleReport = () => {
      if (cancelled || document.visibilityState !== 'visible') {
        return;
      }
      void loadReport({ background: true });
    };

    const intervalId = window.setInterval(refreshVisibleReport, GIFT_STATUS_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshVisibleReport);
    refreshVisibleReport();
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshVisibleReport);
    };
  }, [campaignId, isSaving, loadReport, printJob, selectedGift]);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    let cancelled = false;
    async function loadSponsors() {
      try {
        const workspace = await getCampaignSponsorWorkspace(campaignId!);
        if (!cancelled) {
          setSponsors(workspace.sponsors.filter((sponsor) => sponsor.participation.status !== 'CANCELLED'));
        }
      } catch {
        if (!cancelled) {
          setSponsors([]);
        }
      }
    }
    void loadSponsors();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const recipients = useMemo(() => {
    const rows = report?.recipients ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .map((recipient) => ({
        ...recipient,
        gifts: recipient.gifts.filter((gift) => {
          const matchesStatus = !statusFilter || gift.status === statusFilter;
          const matchesQuery = !normalizedQuery || [
            recipient.displayLabel,
            recipient.programRecipientId,
            recipient.group?.name,
            gift.description,
            gift.category,
            gift.labelCode,
            gift.sponsor?.displayName,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));
          return matchesStatus && matchesQuery;
        }),
      }))
      .filter((recipient) => recipient.gifts.length > 0 || (!statusFilter && !normalizedQuery));
  }, [query, report, statusFilter]);

  if (!campaignId) {
    return null;
  }

  function openGiftDrawer(gift: GiftWorkflowReportGift, recipient: GiftWorkflowReportRecipient) {
    setSelectedGift({ gift, recipient });
    setSelectedSponsorId(gift.sponsor?.id ?? '');
    setActionNotes('');
    setMessage(null);
    setError(null);
  }

  async function refreshAfterGiftChange() {
    await loadReport();
    setSelectedGift(null);
    setActionNotes('');
  }

  async function handleCommitGift() {
    if (!campaignId || !selectedGift || !selectedSponsorId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await commitCampaignGift(campaignId, selectedGift.gift.id, selectedSponsorId, actionNotes);
      setMessage(`${selectedGift.gift.description} committed.`);
      await refreshAfterGiftChange();
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Unable to commit gift.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleWorkflowAction(action: GiftOperationsAction) {
    if (!campaignId || !selectedGift) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateCampaignGiftOperation(campaignId, selectedGift.gift.id, action, actionNotes);
      setMessage(`${selectedGift.gift.description} updated.`);
      await refreshAfterGiftChange();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update gift status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDistributeGift() {
    if (!campaignId || !selectedGift) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateGiftScanAction(campaignId, selectedGift.gift.labelCode, 'DISTRIBUTE', actionNotes);
      setMessage(`${selectedGift.gift.description} marked distributed.`);
      await refreshAfterGiftChange();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to distribute gift.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePrintGiftTag() {
    if (!campaignId || !selectedGift) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const job = await createGiftLabelPrintJob(campaignId, {
        wishlistItemIds: [selectedGift.gift.id],
        copies: 1,
        format: 'TAG',
      });
      setPrintJob(job);
      setMessage('Gift tag queued for printing.');
      await loadReport();
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : 'Unable to create gift tag.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="campaign-studio-page gift-workflow-page gift-workflow-report">
      <div className="campaign-studio-page__header">
        <div>
          <div className="text-uppercase small text-muted fw-semibold mb-1">Gift Workflow</div>
          <h1 className="h3 mb-1">Recipient Gift Status Report</h1>
          <p className="text-muted mb-0">
            See every recipient, their wishlist gifts, and where each gift sits in the workflow.
          </p>
        </div>
        <div className="gift-workflow-report__header-actions">
          <div className={`gift-workflow-report__sync ${isAutoRefreshing ? 'is-refreshing' : ''}`} aria-live="polite">
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            <span>
              {isAutoRefreshing
                ? 'Updating...'
                : lastRefreshedAt
                  ? `Updated ${formatSyncTime(lastRefreshedAt)}`
                  : 'Auto-refresh on'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={isLoading || isAutoRefreshing}
            onClick={() => void loadReport()}
          >
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
            Refresh
          </button>
          <Link to={buildCampaignGiftsSearchPath(campaignId)} className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-search me-2" aria-hidden="true" />
            Gift Search
          </Link>
          <Link to={buildCampaignGiftsOperationsPath(campaignId)} className="btn btn-secondary btn-sm">
            <i className="bi bi-clipboard-check me-2" aria-hidden="true" />
            Operations
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}

      <div className="campaign-studio__stat-grid campaign-team-stats">
        <StatCard label="Recipients" value={report?.counts.recipient_count ?? 0} />
        <StatCard label="Gifts" value={report?.counts.gift_count ?? 0} />
        <StatCard label="Covered" value={report?.counts.recipients_covered_count ?? 0} />
        <StatCard label="Need Sponsors" value={report?.counts.recipients_needing_gifts_count ?? 0} />
        <StatCard label="Open Work" value={report?.counts.recipients_with_open_work_count ?? 0} />
        <StatCard label="Complete" value={report?.counts.recipients_complete_count ?? 0} />
      </div>

      <section className="gift-workflow-report__toolbar">
        <div className="d-flex flex-column flex-lg-row gap-2 flex-grow-1">
          <label className="visually-hidden" htmlFor="gift-report-search">Search gift report</label>
          <input
            id="gift-report-search"
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipient, group, sponsor, gift, or label"
          />
          <label className="visually-hidden" htmlFor="gift-report-status">Filter by status</label>
          <select
            id="gift-report-status"
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {report?.statuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </div>
        <div className="gift-workflow-report__legend" aria-label="Gift workflow status legend">
          {DISPLAY_STEPS.map((status) => (
            <span
              key={status}
              className="gift-workflow-report__legend-item"
              style={{ '--gift-status-color': STATUS_COLORS[status] } as CSSProperties}
            >
              <span className="gift-workflow-report__dot" aria-hidden="true" />
              {shortStatusLabel(status)}
            </span>
          ))}
        </div>
      </section>

      {isLoading && !report ? (
        <div className="content-card">Loading gift workflow report...</div>
      ) : recipients.length === 0 ? (
        <div className="gift-workflow-report__empty">No recipient gifts match the current filters.</div>
      ) : (
        <section className="gift-workflow-report__recipient-list">
          {recipients.map((recipient) => (
            <RecipientWorkflowCard
              key={recipient.id}
              recipient={recipient}
              onOpenGift={(gift) => openGiftDrawer(gift, recipient)}
            />
          ))}
        </section>
      )}

      <CampaignStudioDrawer
        isOpen={selectedGift !== null}
        title={selectedGift?.gift.description ?? 'Gift'}
        description={selectedGift ? `${selectedGift.recipient.displayLabel} · ${statusLabel(selectedGift.gift.status)}` : undefined}
        onClose={() => setSelectedGift(null)}
        width="wide"
      >
        {selectedGift ? (
          <div className="campaign-team-drawer__stack">
            <section className="campaign-team-drawer__section">
              <div className="row g-3">
                <DrawerDetail label="Recipient" value={selectedGift.recipient.displayLabel} />
                <DrawerDetail label="Group" value={selectedGift.recipient.group?.name ?? 'No group'} />
                <DrawerDetail label="Label" value={selectedGift.gift.labelCode} />
                <DrawerDetail label="Sponsor" value={selectedGift.gift.sponsor?.displayName ?? 'No sponsor'} />
                <DrawerDetail label="Status" value={statusLabel(selectedGift.gift.status)} />
                <DrawerDetail label="Quantity" value={`${selectedGift.gift.quantityFulfilled}/${selectedGift.gift.quantityRequested}`} />
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
                  placeholder="Optional status or sponsor note"
                />
              </label>
              <div className="campaign-team-drawer__actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={isSaving}
                  onClick={() => void handlePrintGiftTag()}
                >
                  <i className="bi bi-printer me-2" aria-hidden="true" />
                  Print Tag
                </button>
                {availableWorkflowActions(selectedGift.gift).map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={action === 'exception' ? 'btn btn-outline-danger' : 'btn btn-secondary'}
                    disabled={isSaving}
                    onClick={() => void handleWorkflowAction(action)}
                  >
                    <i className={`bi ${operationActionIcon(action)} me-2`} aria-hidden="true" />
                    {operationActionLabel(action)}
                  </button>
                ))}
                {canDistributeGift(selectedGift.gift) ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isSaving}
                    onClick={() => void handleDistributeGift()}
                  >
                    <i className="bi bi-truck me-2" aria-hidden="true" />
                    Mark Distributed
                  </button>
                ) : null}
              </div>
            </section>

            {canCommitGift(selectedGift.gift) ? (
              <section className="campaign-team-drawer__section">
                <div className="campaign-team-drawer__section-header">
                  <div>
                    <h4 className="h6 mb-1">Commit to Sponsor</h4>
                    <p className="text-muted mb-0">Assign this wishlist gift to an active sponsor.</p>
                  </div>
                </div>
                <label className="form-label">
                  Sponsor
                  <select
                    className="form-select mt-2"
                    value={selectedSponsorId}
                    onChange={(event) => setSelectedSponsorId(event.target.value)}
                  >
                    <option value="">Select a sponsor</option>
                    {sponsors.map((sponsor) => (
                      <option key={sponsor.id} value={sponsor.id}>
                        {sponsor.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!selectedSponsorId || isSaving}
                  onClick={() => void handleCommitGift()}
                >
                  <i className="bi bi-bag-check me-2" aria-hidden="true" />
                  Commit Gift
                </button>
              </section>
            ) : null}
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
    </div>
  );
}

function RecipientWorkflowCard({
  recipient,
  onOpenGift,
}: {
  recipient: GiftWorkflowReportRecipient;
  onOpenGift: (gift: GiftWorkflowReportGift) => void;
}) {
  return (
    <article className="gift-recipient-workflow">
      <header className="gift-recipient-workflow__header">
        <div>
          <h2 className="gift-recipient-workflow__name">{recipient.displayLabel}</h2>
          <div className="gift-recipient-workflow__meta">
            {recipient.group?.name ?? 'No group'} · {recipient.programRecipientId ?? recipient.recipientKind}
            {recipient.age !== null ? ` · Age ${recipient.age}` : ''}
            {recipient.gender ? ` · ${recipient.gender}` : ''}
          </div>
        </div>
        <div className="gift-recipient-workflow__summary">
          <span className="gift-recipient-workflow__summary-pill">{recipient.gifts.length} gifts</span>
          <span className="gift-recipient-workflow__summary-pill">
            {recipient.coverage.isCovered ? 'Covered' : `${recipient.coverage.remainingCount} sponsor${recipient.coverage.remainingCount === 1 ? '' : 's'} needed`}
          </span>
          <span className="gift-recipient-workflow__summary-pill">
            {recipient.coverage.sponsoredCount}/{recipient.coverage.requiredCount} sponsored
          </span>
          <span className="gift-recipient-workflow__summary-pill">{recipient.wishlist?.status ?? 'No wishlist'}</span>
          <span className="gift-recipient-workflow__summary-pill">{recipient.counts.OPEN ?? 0} open</span>
          <span className="gift-recipient-workflow__summary-pill">{recipient.counts.READY_FOR_DISTRIBUTION ?? 0} ready</span>
        </div>
      </header>
      <div className="gift-recipient-workflow__body">
        {recipient.gifts.length === 0 ? (
          <div className="gift-workflow-report__empty">No gifts are on this recipient wishlist.</div>
        ) : (
          recipient.gifts.map((gift) => (
            <GiftWorkflowRow key={gift.id} gift={gift} onOpen={() => onOpenGift(gift)} />
          ))
        )}
      </div>
    </article>
  );
}

function GiftWorkflowRow({ gift, onOpen }: { gift: GiftWorkflowReportGift; onOpen: () => void }) {
  return (
    <button type="button" className="gift-workflow-gift-row" onClick={onOpen}>
      <div className="gift-workflow-gift-row__title">
        <span className="gift-workflow-gift-row__name">{gift.description}</span>
        <span className="gift-workflow-gift-row__meta">
          {gift.category ?? gift.itemType}{gift.size ? ` · ${gift.size}` : ''} · {gift.labelCode}
        </span>
        <span className="gift-workflow-gift-row__meta">
          {gift.sponsor ? `Sponsor: ${gift.sponsor.displayName}` : 'No sponsor'} · Qty {gift.quantityFulfilled}/{gift.quantityRequested}
        </span>
      </div>
      <div className="gift-workflow-gift-row__progress" aria-label={`${gift.description} workflow status`}>
        {DISPLAY_STEPS.map((step) => (
          <WorkflowStep key={step} gift={gift} step={step} />
        ))}
        {gift.status === 'EXCEPTION' || gift.status === 'CANCELLED' ? (
          <WorkflowStep gift={gift} step={gift.status} />
        ) : null}
      </div>
    </button>
  );
}

function WorkflowStep({ gift, step }: { gift: GiftWorkflowReportGift; step: GiftWorkflowStatus }) {
  const currentIndex = statusRank(gift.status);
  const stepIndex = statusRank(step);
  const isCurrent = gift.status === step;
  const isComplete = stepIndex >= 0 && currentIndex >= stepIndex && !['EXCEPTION', 'CANCELLED'].includes(gift.status);
  return (
    <div
      className={`gift-workflow-step ${isComplete ? 'is-complete' : ''} ${isCurrent ? 'is-current' : ''}`}
      style={{ '--gift-status-color': STATUS_COLORS[step] } as CSSProperties}
      title={statusLabel(step)}
    >
      <i className={`bi ${statusIcon(step)} gift-workflow-step__icon`} aria-hidden="true" />
      <span className="gift-workflow-step__label">{shortStatusLabel(step)}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="campaign-studio__stat-card">
      <span className="campaign-studio__stat-label">{label}</span>
      <strong className="campaign-studio__stat-value">{value}</strong>
    </article>
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

function availableWorkflowActions(gift: GiftWorkflowReportGift): GiftOperationsAction[] {
  const actions: GiftOperationsAction[] = [];
  if (gift.status === 'COMMITTED' || gift.status === 'EXCEPTION') {
    actions.push('receive');
  }
  if (gift.status === 'RECEIVED' || gift.status === 'EXCEPTION') {
    actions.push('wrap');
  }
  if (gift.status === 'WRAPPED' || gift.status === 'TAGGED' || gift.status === 'EXCEPTION') {
    actions.push('ready');
  }
  if (gift.status === 'READY_FOR_DISTRIBUTION' || gift.status === 'DISTRIBUTED' || gift.status === 'EXCEPTION') {
    actions.push('pickup');
  }
  if (!['DISTRIBUTED', 'PICKED_UP', 'CANCELLED'].includes(gift.status)) {
    actions.push('exception');
  }
  return actions;
}

function canCommitGift(gift: GiftWorkflowReportGift): boolean {
  return gift.status === 'OPEN' || gift.status === 'RESERVED';
}

function canDistributeGift(gift: GiftWorkflowReportGift): boolean {
  return ['READY_FOR_DISTRIBUTION', 'WRAPPED', 'TAGGED', 'EXCEPTION'].includes(gift.status);
}

function operationActionLabel(action: GiftOperationsAction): string {
  if (action === 'receive') return 'Receive';
  if (action === 'wrap') return 'Wrap';
  if (action === 'ready') return 'Mark Ready';
  if (action === 'pickup') return 'Mark Picked Up';
  return 'Exception';
}

function operationActionIcon(action: GiftOperationsAction): string {
  if (action === 'receive') return 'bi-box-arrow-in-down';
  if (action === 'wrap') return 'bi-gift';
  if (action === 'ready') return 'bi-check2-circle';
  if (action === 'pickup') return 'bi-person-check';
  return 'bi-exclamation-triangle';
}

function statusRank(status: GiftWorkflowStatus): number {
  return DISPLAY_STEPS.indexOf(status);
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortStatusLabel(status: GiftWorkflowStatus): string {
  if (status === 'READY_FOR_DISTRIBUTION') return 'Ready';
  if (status === 'DISTRIBUTED') return 'Distributed';
  return statusLabel(status);
}

function formatSyncTime(value: Date): string {
  return value.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusIcon(status: GiftWorkflowStatus): string {
  if (status === 'OPEN') return 'bi-circle';
  if (status === 'RESERVED') return 'bi-bookmark';
  if (status === 'COMMITTED') return 'bi-bag-check';
  if (status === 'RECEIVED') return 'bi-box-arrow-in-down';
  if (status === 'WRAPPED') return 'bi-gift';
  if (status === 'TAGGED') return 'bi-tag';
  if (status === 'READY_FOR_DISTRIBUTION') return 'bi-check2-circle';
  if (status === 'DISTRIBUTED') return 'bi-truck';
  if (status === 'PICKED_UP') return 'bi-person-check';
  if (status === 'EXCEPTION') return 'bi-exclamation-triangle';
  return 'bi-x-circle';
}
