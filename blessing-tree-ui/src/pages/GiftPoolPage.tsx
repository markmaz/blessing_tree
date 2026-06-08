import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  assignGiftPoolLine,
  createCampaignDonation,
  getCampaignGiftPool,
  getGiftPoolMatches,
  unassignGiftPoolLine,
} from '@/features/gifts/api/giftPoolApi';
import type { GiftPoolAssignment, GiftPoolLine, GiftPoolMatch, GiftPoolResult } from '@/features/gifts/model/giftPoolTypes';
import type { GiftPoolMatchMode } from '@/features/gifts/model/giftPoolTypes';
import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { DrawerActions } from '@/shared/ui/DrawerActions';
import { DrawerSection } from '@/shared/ui/DrawerSection';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { WorkspacePageHeader } from '@/shared/ui/WorkspacePageHeader';
import { WorkspaceSectionHeader } from '@/shared/ui/WorkspaceSectionHeader';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/gifts/ui/giftWorkflow.css';

const INVENTORY_STATUSES = ['AVAILABLE', 'PARTIALLY_ASSIGNED', 'ASSIGNED', 'CONSUMED', 'ARCHIVED'] as const;

interface DonationFormState {
  source: string;
  notes: string;
  description: string;
  category: string;
  size: string;
  quantity: string;
  ageMin: string;
  ageMax: string;
  genderFit: string;
  giftCondition: string;
  sourceLabel: string;
  lineNotes: string;
}

const EMPTY_FORM: DonationFormState = {
  source: 'DROP_OFF',
  notes: '',
  description: '',
  category: '',
  size: '',
  quantity: '1',
  ageMin: '',
  ageMax: '',
  genderFit: 'ANY',
  giftCondition: 'NEW',
  sourceLabel: '',
  lineNotes: '',
};

export function GiftPoolPage() {
  const { campaignId = null } = useParams();
  const { campaigns, selectedCampaignId, selectCampaign } = useCampaigns();
  const [result, setResult] = useState<GiftPoolResult | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [form, setForm] = useState<DonationFormState>(EMPTY_FORM);
  const [selectedLine, setSelectedLine] = useState<GiftPoolLine | null>(null);
  const [matches, setMatches] = useState<GiftPoolMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentQuantity, setAssignmentQuantity] = useState('1');
  const [matchMode, setMatchMode] = useState<GiftPoolMatchMode>('suggested');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [pendingAssignment, setPendingAssignment] = useState<{ match: GiftPoolMatch; quantity: number } | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<GiftPoolAssignment | null>(null);

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  const loadPool = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCampaignGiftPool(campaignId, {
        status: statusFilter,
        search: appliedSearch,
      });
      setResult(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load gift pool.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, campaignId, statusFilter]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const lines = result?.lines ?? [];
  const inventorySummary = useMemo(() => summarizeInventory(lines), [lines]);

  const selectedLineFromResult = useMemo(
    () => result?.lines.find((line) => line.id === selectedLine?.id) ?? selectedLine,
    [result, selectedLine]
  );

  async function loadMatches(
    line: GiftPoolLine,
    options: { mode?: GiftPoolMatchMode; query?: string; reset?: boolean } = {}
  ) {
    if (!campaignId) {
      return;
    }
    const nextMode = options.mode ?? matchMode;
    const nextQuery = options.query ?? candidateSearch;
    setSelectedLine(line);
    if (options.reset) {
      setAssignmentNotes('');
      setAssignmentQuantity('1');
      setCandidateSearch('');
      setMatchMode('suggested');
    } else {
      setMatchMode(nextMode);
    }
    setIsLoadingMatches(true);
    setError(null);
    try {
      setMatches(await getGiftPoolMatches(campaignId, line.id, { mode: nextMode, query: nextQuery, limit: 50 }));
    } catch (matchError) {
      setMatches([]);
      setError(matchError instanceof Error ? matchError.message : 'Unable to load match suggestions.');
    } finally {
      setIsLoadingMatches(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchDraft.trim());
  }

  async function handleCreateDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await createCampaignDonation(campaignId, {
        source: form.source,
        notes: form.notes,
        lines: [
          {
            description: form.description,
            category: form.category || null,
            size: form.size || null,
            quantity: Number(form.quantity || 1),
            ageMin: form.ageMin ? Number(form.ageMin) : null,
            ageMax: form.ageMax ? Number(form.ageMax) : null,
            genderFit: form.genderFit,
            giftCondition: form.giftCondition,
            sourceLabel: form.sourceLabel || null,
            notes: form.lineNotes || null,
          },
        ],
      });
      setMessage('Donation inventory added.');
      setForm(EMPTY_FORM);
      setIsIntakeOpen(false);
      await loadPool();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add donation inventory.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAssign(match: GiftPoolMatch) {
    if (!selectedLineFromResult) {
      return;
    }
    const parsedQuantity = Number(assignmentQuantity);
    const requestedQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
    const quantity = Math.max(
      1,
      Math.min(requestedQuantity, selectedLineFromResult.quantityAvailable, match.wishlistItem.qtyRemaining)
    );
    setPendingAssignment({ match, quantity });
  }

  async function confirmAssignment() {
    if (!campaignId || !selectedLineFromResult || !pendingAssignment) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await assignGiftPoolLine(campaignId, selectedLineFromResult.id, {
        wishlistItemId: pendingAssignment.match.wishlistItem.wishlistItemId,
        quantity: pendingAssignment.quantity,
        notes: assignmentNotes,
      });
      setMessage(`${pendingAssignment.quantity} ${selectedLineFromResult.description} assigned to ${recipientLabel(pendingAssignment.match.wishlistItem)}.`);
      setAssignmentNotes('');
      setAssignmentQuantity('1');
      setPendingAssignment(null);
      await loadPool();
      await loadMatches(selectedLineFromResult, { mode: matchMode, query: candidateSearch });
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Unable to assign inventory.');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmUnassign() {
    if (!campaignId || !selectedLineFromResult || !pendingUnassign) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await unassignGiftPoolLine(campaignId, selectedLineFromResult.id, pendingUnassign.id, {
        notes: 'Removed from Gift Pool assignment drawer.',
      });
      setMessage(`${result.quantity} ${selectedLineFromResult.description} assignment removed from ${pendingUnassign.wishlistItem ? recipientLabel(pendingUnassign.wishlistItem) : 'recipient'}.`);
      setPendingUnassign(null);
      await loadPool();
      await loadMatches(selectedLineFromResult, { mode: matchMode, query: candidateSearch });
    } catch (unassignError) {
      setError(unassignError instanceof Error ? unassignError.message : 'Unable to remove assignment.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCandidateSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLineFromResult) {
      return;
    }
    setMatchMode('search');
    if (!candidateSearch.trim()) {
      setMatches([]);
      return;
    }
    void loadMatches(selectedLineFromResult, { mode: 'search', query: candidateSearch });
  }

  function handleModeChange(nextMode: GiftPoolMatchMode) {
    if (!selectedLineFromResult) {
      return;
    }
    setMatchMode(nextMode);
    if (nextMode === 'search' && !candidateSearch.trim()) {
      setMatches([]);
      return;
    }
    void loadMatches(selectedLineFromResult, { mode: nextMode, query: nextMode === 'search' ? candidateSearch : '' });
  }

  if (!campaignId) {
    return null;
  }

  return (
    <div className="campaign-studio-page gift-workflow-page">
      <WorkspacePageHeader
        title="Gift Pool"
        description={`${campaign?.name ?? 'Campaign'} donated inventory intake and wishlist matching.`}
        chips={<span className="campaign-chip campaign-chip-muted">Gift Workflow</span>}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setIsIntakeOpen(true)}>
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Add Inventory
          </button>
        }
      />

      <div className="campaign-studio__stat-grid campaign-team-stats">
        <StatCard label="Inventory Lines" value={countStatus(result, 'TOTAL')} />
        <StatCard label="Total Items" value={inventorySummary.totalQuantity} />
        <StatCard label="Available Items" value={inventorySummary.availableQuantity} />
        <StatCard label="Assigned Items" value={inventorySummary.assignedQuantity} />
        <StatCard label="Partially Assigned Lines" value={countStatus(result, 'PARTIALLY_ASSIGNED')} />
        <StatCard label="Archived Lines" value={countStatus(result, 'ARCHIVED')} />
      </div>

      <section className="content-card">
        <form className="campaign-team-toolbar" onSubmit={handleSearch}>
          <label className="form-label campaign-team-toolbar__search mb-0">
            <span className="small text-uppercase text-muted fw-semibold">Search Inventory</span>
            <input
              className="form-control mt-2"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search description, category, or source label"
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
              {INVENTORY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {toLabel(status)}
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
        <WorkspaceSectionHeader
          title="Inventory"
          description="Click a row to review match suggestions and assign available donated goods."
          actions={<span className="text-muted small">{lines.length} visible line{lines.length === 1 ? '' : 's'}</span>}
        />

        {isLoading && !result ? (
          <p className="text-muted mb-0">Loading gift pool...</p>
        ) : lines.length === 0 ? (
          <div className="campaign-studio__empty-note">No inventory matches the current filter.</div>
        ) : (
          <div className="campaign-team-table-wrap">
            <table className="table campaign-team-table align-middle">
              <thead>
                <tr>
                  <th>Inventory</th>
                  <th>Fit</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Donation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <GiftPoolRow
                    key={line.id}
                    line={line}
                    isSaving={isSaving}
                    onOpen={() => void loadMatches(line, { mode: 'suggested', query: '', reset: true })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CampaignStudioDrawer
        isOpen={isIntakeOpen}
        title="Add Inventory"
        description="Record donated goods that are not already tied to a wishlist."
        onClose={() => setIsIntakeOpen(false)}
        width="wide"
      >
        <form className="campaign-team-drawer__stack" onSubmit={handleCreateDonation}>
          <DrawerSection title="Donation Source" description="Where this inventory came from and any intake notes.">
            <div className="campaign-team-form-grid">
              <label className="form-label">
                Source
                <select
                  className="form-select mt-2"
                  value={form.source}
                  onChange={(event) => setFormValue(setForm, 'source', event.target.value)}
                >
                  <option value="DROP_OFF">Drop Off</option>
                  <option value="SHIPMENT">Shipment</option>
                  <option value="CHURCH_PURCHASE">Church Purchase</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="form-label">
                Source Label
                <input
                  className="form-control mt-2"
                  value={form.sourceLabel}
                  onChange={(event) => setFormValue(setForm, 'sourceLabel', event.target.value)}
                  placeholder="Coat drive, scout troop, extra gifts"
                />
              </label>
              <label className="form-label campaign-team-form-grid__span-2">
                Donation Notes
                <textarea
                  className="form-control mt-2"
                  rows={2}
                  value={form.notes}
                  onChange={(event) => setFormValue(setForm, 'notes', event.target.value)}
                />
              </label>
            </div>
          </DrawerSection>

          <DrawerSection title="Inventory Line" description="Describe the available item and who it may fit.">
            <div className="campaign-team-form-grid">
              <label className="form-label campaign-team-form-grid__span-2">
                Description
                <input
                  className="form-control mt-2"
                  value={form.description}
                  onChange={(event) => setFormValue(setForm, 'description', event.target.value)}
                  placeholder="Winter coats, Lego sets, $25 gift cards"
                  required
                />
              </label>
              <label className="form-label">
                Category
                <input
                  className="form-control mt-2"
                  value={form.category}
                  onChange={(event) => setFormValue(setForm, 'category', event.target.value)}
                />
              </label>
              <label className="form-label">
                Size
                <input
                  className="form-control mt-2"
                  value={form.size}
                  onChange={(event) => setFormValue(setForm, 'size', event.target.value)}
                />
              </label>
              <label className="form-label">
                Quantity
                <input
                  className="form-control mt-2"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => setFormValue(setForm, 'quantity', event.target.value)}
                  required
                />
              </label>
              <label className="form-label">
                Gender Fit
                <select
                  className="form-select mt-2"
                  value={form.genderFit}
                  onChange={(event) => setFormValue(setForm, 'genderFit', event.target.value)}
                >
                  <option value="ANY">Any</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="X">Nonbinary</option>
                  <option value="U">Unknown</option>
                  <option value="UNSPECIFIED">Unspecified</option>
                </select>
              </label>
              <label className="form-label">
                Age Min
                <input
                  className="form-control mt-2"
                  type="number"
                  min="0"
                  value={form.ageMin}
                  onChange={(event) => setFormValue(setForm, 'ageMin', event.target.value)}
                />
              </label>
              <label className="form-label">
                Age Max
                <input
                  className="form-control mt-2"
                  type="number"
                  min="0"
                  value={form.ageMax}
                  onChange={(event) => setFormValue(setForm, 'ageMax', event.target.value)}
                />
              </label>
              <label className="form-label">
                Condition
                <select
                  className="form-select mt-2"
                  value={form.giftCondition}
                  onChange={(event) => setFormValue(setForm, 'giftCondition', event.target.value)}
                >
                  <option value="NEW">New</option>
                  <option value="LIKE_NEW">Like New</option>
                  <option value="USED_ACCEPTABLE">Used Acceptable</option>
                </select>
              </label>
              <label className="form-label campaign-team-form-grid__span-2">
                Line Notes
                <textarea
                  className="form-control mt-2"
                  rows={2}
                  value={form.lineNotes}
                  onChange={(event) => setFormValue(setForm, 'lineNotes', event.target.value)}
                />
              </label>
            </div>
          </DrawerSection>

          <DrawerActions>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsIntakeOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-secondary" disabled={isSaving || !form.description.trim()}>
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              {isSaving ? 'Adding...' : 'Add Inventory'}
            </button>
          </DrawerActions>
        </form>
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={selectedLineFromResult !== null}
        title={selectedLineFromResult?.description ?? 'Inventory'}
        description={selectedLineFromResult ? `${toLabel(selectedLineFromResult.inventoryStatus)} inventory` : undefined}
        onClose={() => {
          setSelectedLine(null);
          setMatches([]);
          setCandidateSearch('');
          setPendingAssignment(null);
          setPendingUnassign(null);
        }}
        width="wide"
      >
        {selectedLineFromResult ? (
          <div className="campaign-team-drawer__stack">
            <DrawerSection title="Inventory Details" description="Available quantity and matching attributes.">
              <div className="row g-3">
                <DrawerDetail label="Available" value={`${selectedLineFromResult.quantityAvailable} of ${selectedLineFromResult.quantity}`} />
                <DrawerDetail label="Category" value={selectedLineFromResult.category ?? 'Not set'} />
                <DrawerDetail label="Size" value={selectedLineFromResult.size ?? 'Not set'} />
                <DrawerDetail label="Fit" value={formatFit(selectedLineFromResult)} />
              </div>
            </DrawerSection>

            <DrawerSection
              title="Assignments"
              description="Current recipients assigned from this inventory line."
            >
              {selectedLineFromResult.assignments.length === 0 ? (
                <div className="campaign-studio__empty-note">This inventory has not been assigned yet.</div>
              ) : (
                <div className="campaign-team-inline-list">
                  {selectedLineFromResult.assignments.map((assignment) => (
                    <div key={assignment.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                      <div className="campaign-team-inline-item__content">
                        <strong>{assignment.wishlistItem ? recipientLabel(assignment.wishlistItem) : assignment.wishlistItemId}</strong>
                        <span className="text-muted small">
                          {assignment.quantityFulfilled} assigned
                          {assignment.wishlistItem ? ` · ${assignment.wishlistItem.description}` : ''}
                        </span>
                        <span className="text-muted small">
                          {assignment.fulfilledAt ? `Assigned ${formatDateTime(assignment.fulfilledAt)}` : 'Assignment date not available'}
                          {assignment.fulfilledByDisplayName ? ` by ${assignment.fulfilledByDisplayName}` : ''}
                        </span>
                        {assignment.notes ? <span className="text-muted small">{assignment.notes}</span> : null}
                      </div>
                      <div className="campaign-team-inline-item__actions">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={isSaving}
                          onClick={() => setPendingUnassign(assignment)}
                        >
                          <i className="bi bi-arrow-counterclockwise me-2" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>

            <DrawerSection
              title="Find Recipient Gifts"
              description={matchModeDescription(matchMode)}
            >
              <div className="btn-group mb-3" role="group" aria-label="Assignment candidate mode">
                <button
                  type="button"
                  className={`btn btn-sm ${matchMode === 'suggested' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => handleModeChange('suggested')}
                >
                  Suggested Matches
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${matchMode === 'needs_gifts' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => handleModeChange('needs_gifts')}
                >
                  Needs Gifts
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${matchMode === 'search' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => handleModeChange('search')}
                >
                  Search
                </button>
              </div>

              <form className="campaign-team-toolbar mb-3" onSubmit={handleCandidateSearch}>
                <label className="form-label campaign-team-toolbar__search mb-0">
                  <span className="small text-uppercase text-muted fw-semibold">Recipient or gift search</span>
                  <input
                    className="form-control mt-2"
                    value={candidateSearch}
                    onChange={(event) => setCandidateSearch(event.target.value)}
                    placeholder="BT-001, family ID, name, toy, coat, size"
                  />
                </label>
                <button type="submit" className="btn btn-secondary" disabled={isLoadingMatches}>
                  <i className="bi bi-search me-2" aria-hidden="true" />
                  Search
                </button>
              </form>

              <div className="campaign-team-form-grid mb-3">
                <label className="form-label">
                  Quantity to Assign
                  <input
                    className="form-control mt-2"
                    type="number"
                    min="1"
                    max={selectedLineFromResult.quantityAvailable}
                    value={assignmentQuantity}
                    onChange={(event) => setAssignmentQuantity(event.target.value)}
                  />
                </label>
                <label className="form-label campaign-team-form-grid__span-2">
                  Assignment Notes
                  <textarea
                    className="form-control mt-2"
                    rows={2}
                    value={assignmentNotes}
                    onChange={(event) => setAssignmentNotes(event.target.value)}
                  />
                </label>
              </div>
              {isLoadingMatches ? (
                <p className="text-muted mb-0">Loading recipients...</p>
              ) : matches.length === 0 ? (
                <div className="campaign-studio__empty-note">{emptyMatchMessage(matchMode)}</div>
              ) : (
                <>
                  <div className="small text-uppercase text-muted fw-semibold mb-2">{matchModeHeading(matchMode)}</div>
                  <div className="campaign-team-inline-list">
                    {matches.map((match) => (
                      <div key={match.wishlistItem.wishlistItemId} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                        <div className="campaign-team-inline-item__content">
                          <strong>{recipientLabel(match.wishlistItem)}</strong>
                          <span className="text-muted small">
                            {match.wishlistItem.description}
                            {match.wishlistItem.size ? ` · ${match.wishlistItem.size}` : ''}
                            {match.wishlistItem.category ? ` · ${match.wishlistItem.category}` : ''}
                          </span>
                          <span className="text-muted small">
                            {recipientDetail(match.wishlistItem)} · {match.wishlistItem.qtyRemaining} needed
                            {matchMode === 'suggested' && match.score > 0 ? ` · Score ${match.score}` : ''}
                          </span>
                          <span className="campaign-team-inline-meta">
                            {match.reasons.map((reason) => (
                              <span key={reason} className="campaign-chip campaign-chip-muted">{reason}</span>
                            ))}
                          </span>
                        </div>
                        <div className="campaign-team-inline-item__actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isSaving || selectedLineFromResult.quantityAvailable < 1 || match.wishlistItem.qtyRemaining < 1}
                            onClick={() => handleAssign(match)}
                          >
                            <i className="bi bi-link-45deg me-2" aria-hidden="true" />
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </DrawerSection>
          </div>
        ) : null}
      </CampaignStudioDrawer>

      <ConfirmationModal
        open={pendingAssignment !== null && selectedLineFromResult !== null}
        title="Assign Pool Inventory?"
        message={
          pendingAssignment && selectedLineFromResult
            ? `Assign ${pendingAssignment.quantity} ${selectedLineFromResult.description} to ${recipientLabel(pendingAssignment.match.wishlistItem)} for "${pendingAssignment.match.wishlistItem.description}"?`
            : 'Assign this inventory item?'
        }
        details={
          pendingAssignment && selectedLineFromResult
            ? [
                `Inventory: ${selectedLineFromResult.description}`,
                `Quantity: ${pendingAssignment.quantity}`,
                `Recipient: ${recipientLabel(pendingAssignment.match.wishlistItem)}`,
                `Wishlist item: ${pendingAssignment.match.wishlistItem.description}`,
              ]
            : []
        }
        detailsHeading="This will assign"
        confirmLabel={isSaving ? 'Assigning...' : 'Assign Inventory'}
        tone="secondary"
        isSubmitting={isSaving}
        onConfirm={confirmAssignment}
        onClose={() => {
          if (!isSaving) {
            setPendingAssignment(null);
          }
        }}
      >
        <p className="text-muted small mb-0">
          This reduces the available inventory quantity and updates the recipient gift. Remove the assignment later if this was a mistake.
        </p>
      </ConfirmationModal>

      <ConfirmationModal
        open={pendingUnassign !== null && selectedLineFromResult !== null}
        title="Remove Pool Assignment?"
        message={
          pendingUnassign && selectedLineFromResult
            ? `Remove ${pendingUnassign.quantityFulfilled} ${selectedLineFromResult.description} from ${pendingUnassign.wishlistItem ? recipientLabel(pendingUnassign.wishlistItem) : 'this recipient'}?`
            : 'Remove this pool assignment?'
        }
        details={
          pendingUnassign
            ? [
                `Recipient: ${pendingUnassign.wishlistItem ? recipientLabel(pendingUnassign.wishlistItem) : pendingUnassign.wishlistItemId}`,
                `Wishlist item: ${pendingUnassign.wishlistItem?.description ?? pendingUnassign.wishlistItemId}`,
                `Quantity: ${pendingUnassign.quantityFulfilled}`,
              ]
            : []
        }
        detailsHeading="This will remove"
        confirmLabel={isSaving ? 'Removing...' : 'Remove Assignment'}
        tone="danger"
        isSubmitting={isSaving}
        onConfirm={confirmUnassign}
        onClose={() => {
          if (!isSaving) {
            setPendingUnassign(null);
          }
        }}
      >
        <p className="text-muted small mb-0">
          The inventory quantity becomes available again. The recipient gift returns to open if this removal means it is no longer fully covered.
        </p>
      </ConfirmationModal>
    </div>
  );
}

function GiftPoolRow({
  line,
  isSaving,
  onOpen,
}: {
  line: GiftPoolLine;
  isSaving: boolean;
  onOpen: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <tr className="campaign-team-table__row" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}>
      <td>
        <strong>{line.description}</strong>
        <div className="text-muted small">
          {line.category ?? line.lineType}{line.size ? ` · ${line.size}` : ''}
        </div>
      </td>
      <td>
        <div className="text-muted small">{formatFit(line)}</div>
        <div className="text-muted small">{toLabel(line.giftCondition)}</div>
      </td>
      <td>
        <strong>{line.quantityAvailable}</strong>
        <span className="text-muted small"> available of {line.quantity}</span>
        <div className="text-muted small">{line.quantityAssigned} assigned</div>
      </td>
      <td>
        <span className={`badge ${inventoryBadgeClass(line.inventoryStatus)}`}>{toLabel(line.inventoryStatus)}</span>
      </td>
      <td>
        {toLabel(line.donation.source)}
        <div className="text-muted small">{line.sourceLabel ?? formatDate(line.donation.receivedAt)}</div>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSaving}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <i className="bi bi-search-heart me-1" aria-hidden="true" />
          Match
        </button>
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

function setFormValue(
  setForm: Dispatch<SetStateAction<DonationFormState>>,
  field: keyof DonationFormState,
  value: string
) {
  setForm((current) => ({ ...current, [field]: value }));
}

function countStatus(result: GiftPoolResult | null, status: string): number {
  return result?.counts[status] ?? 0;
}

function summarizeInventory(lines: GiftPoolLine[]) {
  return lines.reduce(
    (summary, line) => ({
      totalQuantity: summary.totalQuantity + line.quantity,
      availableQuantity: summary.availableQuantity + line.quantityAvailable,
      assignedQuantity: summary.assignedQuantity + line.quantityAssigned,
    }),
    { totalQuantity: 0, availableQuantity: 0, assignedQuantity: 0 }
  );
}

function toLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatFit(line: GiftPoolLine): string {
  const age =
    line.ageMin !== null || line.ageMax !== null
      ? `Age ${line.ageMin ?? 'any'}-${line.ageMax ?? 'up'}`
      : 'Any age';
  return `${age} · ${toLabel(line.genderFit)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Not dated';
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not dated';
  }
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function matchModeDescription(mode: GiftPoolMatchMode): string {
  if (mode === 'needs_gifts') {
    return 'Recipients with no current gift coverage, ordered by family and recipient ID.';
  }
  if (mode === 'search') {
    return 'Search by recipient ID, family ID, name, gift, category, or size.';
  }
  return 'Fit-ranked suggestions for this inventory item using category, description, size, age, gender, and priority.';
}

function emptyMatchMessage(mode: GiftPoolMatchMode): string {
  if (mode === 'search') {
    return 'Enter a recipient ID, family ID, name, gift, category, or size to search.';
  }
  if (mode === 'needs_gifts') {
    return 'No recipients without gift coverage were found.';
  }
  return 'No fit-ranked suggestions were found for this inventory item.';
}

function matchModeHeading(mode: GiftPoolMatchMode): string {
  if (mode === 'needs_gifts') {
    return 'Recipients With No Gift Coverage';
  }
  if (mode === 'search') {
    return 'Search Results';
  }
  return 'Suggested Matches';
}

function recipientLabel(item: GiftSearchItem): string {
  const recipient = item.recipient;
  if (!recipient) {
    return 'Unassigned recipient';
  }
  const id = recipient.programRecipientId ?? recipient.groupProgramId;
  const name = recipient.displayLabel ?? recipient.publicLabel ?? 'Recipient';
  return id ? `${id} · ${name}` : name;
}

function recipientDetail(item: GiftSearchItem): string {
  const recipient = item.recipient;
  if (!recipient) {
    return 'No recipient details';
  }
  const details = [
    recipient.groupProgramId ?? recipient.groupLabel,
    recipient.age !== null ? `Age ${recipient.age}` : null,
    recipient.gender ? toLabel(recipient.gender) : null,
  ].filter(Boolean);
  return details.join(' · ') || 'Recipient details not set';
}

function inventoryBadgeClass(status: string): string {
  if (status === 'AVAILABLE') {
    return 'text-bg-success';
  }
  if (status === 'PARTIALLY_ASSIGNED') {
    return 'text-bg-info';
  }
  if (status === 'ARCHIVED') {
    return 'text-bg-secondary';
  }
  return 'text-bg-light border';
}
