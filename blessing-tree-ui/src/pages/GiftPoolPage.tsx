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
} from '@/features/gifts/api/giftPoolApi';
import type { GiftPoolLine, GiftPoolMatch, GiftPoolResult } from '@/features/gifts/model/giftPoolTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
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

  const selectedLineFromResult = useMemo(
    () => result?.lines.find((line) => line.id === selectedLine?.id) ?? selectedLine,
    [result, selectedLine]
  );

  async function loadMatches(line: GiftPoolLine) {
    if (!campaignId) {
      return;
    }
    setSelectedLine(line);
    setAssignmentNotes('');
    setIsLoadingMatches(true);
    setError(null);
    try {
      setMatches(await getGiftPoolMatches(campaignId, line.id));
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

  async function handleAssign(match: GiftPoolMatch) {
    if (!campaignId || !selectedLineFromResult) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await assignGiftPoolLine(campaignId, selectedLineFromResult.id, {
        wishlistItemId: match.wishlistItem.wishlistItemId,
        quantity: 1,
        notes: assignmentNotes,
      });
      setMessage(`${selectedLineFromResult.description} assigned to ${match.wishlistItem.description}.`);
      setAssignmentNotes('');
      await loadPool();
      await loadMatches(selectedLineFromResult);
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Unable to assign inventory.');
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
          <h1 className="h3 mb-1">Gift Pool</h1>
          <p className="text-muted mb-0">
            {campaign?.name ?? 'Campaign'} donated inventory intake and wishlist matching.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setIsIntakeOpen(true)}>
          <i className="bi bi-plus-lg me-2" aria-hidden="true" />
          Add Inventory
        </button>
      </div>

      <div className="campaign-studio__stat-grid campaign-team-stats">
        <StatCard label="Total Lines" value={countStatus(result, 'TOTAL')} />
        <StatCard label="Available" value={countStatus(result, 'AVAILABLE')} />
        <StatCard label="Partially Assigned" value={countStatus(result, 'PARTIALLY_ASSIGNED')} />
        <StatCard label="Assigned" value={countStatus(result, 'ASSIGNED')} />
        <StatCard label="Consumed" value={countStatus(result, 'CONSUMED')} />
        <StatCard label="Archived" value={countStatus(result, 'ARCHIVED')} />
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
        <div className="campaign-team-workspace__section-header">
          <div>
            <h2 className="h5 mb-1">Inventory</h2>
            <p className="text-muted mb-0">
              Click a row to review match suggestions and assign available donated goods.
            </p>
          </div>
          <span className="text-muted small">{lines.length} visible line{lines.length === 1 ? '' : 's'}</span>
        </div>

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
                    onOpen={() => void loadMatches(line)}
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
          <section className="campaign-team-drawer__section">
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
          </section>

          <section className="campaign-team-drawer__section">
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
          </section>

          <div className="campaign-team-drawer__actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsIntakeOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-secondary" disabled={isSaving || !form.description.trim()}>
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              {isSaving ? 'Adding...' : 'Add Inventory'}
            </button>
          </div>
        </form>
      </CampaignStudioDrawer>

      <CampaignStudioDrawer
        isOpen={selectedLineFromResult !== null}
        title={selectedLineFromResult?.description ?? 'Inventory'}
        description={selectedLineFromResult ? `${toLabel(selectedLineFromResult.inventoryStatus)} inventory` : undefined}
        onClose={() => {
          setSelectedLine(null);
          setMatches([]);
        }}
        width="wide"
      >
        {selectedLineFromResult ? (
          <div className="campaign-team-drawer__stack">
            <section className="campaign-team-drawer__section">
              <div className="row g-3">
                <DrawerDetail label="Available" value={`${selectedLineFromResult.quantityAvailable} of ${selectedLineFromResult.quantity}`} />
                <DrawerDetail label="Category" value={selectedLineFromResult.category ?? 'Not set'} />
                <DrawerDetail label="Size" value={selectedLineFromResult.size ?? 'Not set'} />
                <DrawerDetail label="Fit" value={formatFit(selectedLineFromResult)} />
              </div>
            </section>

            <section className="campaign-team-drawer__section">
              <label className="form-label">
                Assignment Notes
                <textarea
                  className="form-control mt-2"
                  rows={2}
                  value={assignmentNotes}
                  onChange={(event) => setAssignmentNotes(event.target.value)}
                />
              </label>
              <div className="campaign-team-drawer__section-header">
                <div>
                  <h4 className="h6 mb-1">Match Suggestions</h4>
                  <p className="text-muted mb-0">Suggestions use category, description, size, age, gender, and priority.</p>
                </div>
              </div>
              {isLoadingMatches ? (
                <p className="text-muted mb-0">Loading matches...</p>
              ) : matches.length === 0 ? (
                <div className="campaign-studio__empty-note">No open wishlist matches were found.</div>
              ) : (
                <div className="campaign-team-inline-list">
                  {matches.map((match) => (
                    <div key={match.wishlistItem.wishlistItemId} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                      <div className="campaign-team-inline-item__content">
                        <strong>{match.wishlistItem.description}</strong>
                        <span className="text-muted small">
                          {match.wishlistItem.recipient?.displayLabel ?? 'Recipient'} · Score {match.score}
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
                          disabled={isSaving || selectedLineFromResult.quantityAvailable < 1}
                          onClick={() => void handleAssign(match)}
                        >
                          <i className="bi bi-link-45deg me-2" aria-hidden="true" />
                          Assign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </CampaignStudioDrawer>
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
