import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  createOrganizationType,
  deleteOrganizationType,
  fetchOrganizationTypes,
  updateOrganizationType,
} from '@/features/admin/api/adminApi';
import type { AdminOrganizationType } from '@/features/admin/model/adminTypes';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';
import { FieldHelpButton } from '@/features/ask/ui/FieldHelpButton';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import '@/features/admin/ui/adminUsers.css';
import '@/features/admin/ui/adminCampaignOperations.css';

interface OrganizationTypeDraft {
  code: string;
  label: string;
  recipientCategory: AdminOrganizationType['recipientCategory'];
  isActive: boolean;
  sortOrder: string;
}

const emptyDraft: OrganizationTypeDraft = {
  code: '',
  label: '',
  recipientCategory: 'ADULT',
  isActive: true,
  sortOrder: '100',
};

function formatRecipientCategory(value: AdminOrganizationType['recipientCategory']): string {
  if (value === 'CHILD') {
    return 'Children';
  }
  if (value === 'FAMILY') {
    return 'Families';
  }
  return 'Adults';
}

export function AdminOrganizationTypesPage() {
  const { selectedCampaignId } = useCampaigns();
  const [organizationTypes, setOrganizationTypes] = useState<AdminOrganizationType[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrganizationTypeDraft>(emptyDraft);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedType = useMemo(
    () => organizationTypes.find((type) => type.code === selectedCode) ?? null,
    [organizationTypes, selectedCode]
  );

  async function loadOrganizationTypes() {
    setError(null);
    try {
      const payload = await fetchOrganizationTypes();
      setOrganizationTypes(payload.organizationTypes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load organization types.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrganizationTypes();
  }, []);

  function startNewType() {
    setSelectedCode(null);
    setDraft(emptyDraft);
    setIsDrawerOpen(true);
    setMessage(null);
    setError(null);
  }

  function selectType(type: AdminOrganizationType) {
    setSelectedCode(type.code);
    setDraft({
      code: type.code,
      label: type.label,
      recipientCategory: type.recipientCategory,
      isActive: type.isActive,
      sortOrder: String(type.sortOrder),
    });
    setIsDrawerOpen(true);
    setMessage(null);
    setError(null);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setSelectedCode(null);
    setDraft(emptyDraft);
  }

  async function saveType() {
    if (!draft.label.trim()) {
      setError('Label is required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const sortOrder = Number.parseInt(draft.sortOrder || '100', 10);
      if (selectedType) {
        await updateOrganizationType(selectedType.code, {
          label: draft.label.trim(),
          recipientCategory: draft.recipientCategory,
          isActive: draft.isActive,
          sortOrder: Number.isNaN(sortOrder) ? 100 : sortOrder,
        });
        setMessage('Organization type updated.');
      } else {
        await createOrganizationType({
          code: draft.code.trim() || undefined,
          label: draft.label.trim(),
          recipientCategory: draft.recipientCategory,
          isActive: draft.isActive,
          sortOrder: Number.isNaN(sortOrder) ? 100 : sortOrder,
        });
        setMessage('Organization type added.');
      }
      await loadOrganizationTypes();
      closeDrawer();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save organization type.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeType(type: AdminOrganizationType) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteOrganizationType(type.code);
      setMessage('Organization type removed from active use.');
      await loadOrganizationTypes();
      closeDrawer();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to remove organization type.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="content-card">Loading organization types...</div>;
  }

  return (
    <div className="admin-campaign-ops">
      <div className="content-card admin-campaign-ops__header">
        <div>
          <h2 className="h5 mb-1">Organization Types</h2>
          <p className="text-muted mb-0">
            Manage the global organization list used during People intake. People Served controls whether the organization flow adds children, adults, or families.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={startNewType}>
          <i className="bi bi-plus-square me-2" aria-hidden="true" />
          New Type
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {message ? (
        <AutoDismissAlert message={message} onDismiss={() => setMessage(null)} variant="success" />
      ) : null}

      <div className="content-card admin-campaign-ops-table-card">
        <div className="table-responsive">
          <table className="table admin-campaign-ops-table align-middle mb-0">
            <thead>
              <tr>
                <th>Type</th>
                <th>People Served</th>
                <th>Status</th>
                <th>Sort</th>
              </tr>
            </thead>
            <tbody>
              {organizationTypes.map((type) => (
                <tr
                  key={type.code}
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit organization type ${type.label}`}
                  className={`admin-campaign-ops-action-row ${selectedCode === type.code ? 'is-selected' : ''}`}
                  onClick={() => selectType(type)}
                  onKeyDown={(event) => handleActionRowKeyDown(event, () => selectType(type))}
                >
                  <td>
                    <span className="admin-campaign-ops-row-button">
                      <span className="fw-semibold">{type.label}</span>
                      <span className="text-muted small">{type.code}</span>
                    </span>
                  </td>
                  <td>{formatRecipientCategory(type.recipientCategory)}</td>
                  <td>
                    <OrganizationTypeStatusBadge isActive={type.isActive} />
                  </td>
                  <td>{type.sortOrder}</td>
                </tr>
              ))}
              {organizationTypes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">No organization types have been configured.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AdminWorkspaceDrawer
        isOpen={isDrawerOpen}
        title={selectedType ? 'Edit Organization Type' : 'New Organization Type'}
        description="Organization types are global and control the People intake flow for organizations."
        onClose={closeDrawer}
        width="wide"
      >
        <div className="admin-users-drawer__stack">
          {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
          <section className="admin-users-drawer__section">
            <div className="admin-users-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">Type Details</h4>
                <p className="text-muted small mb-0">
                  People Served determines whether intake adds children, adults, or families for organizations using this type.
                </p>
              </div>
            </div>
            <div className="admin-users-form-grid">
              <label className="form-label">
                <span className="d-flex align-items-center gap-1">
                  <span>Code</span>
                  <FieldHelpButton campaignId={selectedCampaignId} screen="Organization Types" fieldName="Code" />
                </span>
                <input
                  className="form-control text-uppercase"
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  disabled={Boolean(selectedType)}
                />
                <span className="form-text">Leave blank for new types to generate it from the label.</span>
              </label>
              <label className="form-label">
                <span className="d-flex align-items-center gap-1">
                  <span>Label</span>
                  <FieldHelpButton campaignId={selectedCampaignId} screen="Organization Types" fieldName="Label" />
                </span>
                <input
                  className="form-control"
                  value={draft.label}
                  onChange={(event) => setDraft((currentValue) => ({ ...currentValue, label: event.target.value }))}
                />
              </label>
              <label className="form-label">
                <span className="d-flex align-items-center gap-1">
                  <span>People Served</span>
                  <FieldHelpButton campaignId={selectedCampaignId} screen="Organization Types" fieldName="People Served" />
                </span>
                <select
                  className="form-select"
                  value={draft.recipientCategory}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      recipientCategory: event.target.value as AdminOrganizationType['recipientCategory'],
                    }))
                  }
                >
                  <option value="ADULT">Adults</option>
                  <option value="CHILD">Children</option>
                  <option value="FAMILY">Families</option>
                </select>
              </label>
              <label className="form-label">
                Sort Order
                <input
                  type="number"
                  className="form-control"
                  value={draft.sortOrder}
                  onChange={(event) => setDraft((currentValue) => ({ ...currentValue, sortOrder: event.target.value }))}
                />
              </label>
              <label className="form-check form-switch admin-users-form-grid__span-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => setDraft((currentValue) => ({ ...currentValue, isActive: event.target.checked }))}
                />
                <span className="form-check-label d-inline-flex align-items-center gap-1">
                  <span>Available in People intake</span>
                  <FieldHelpButton campaignId={selectedCampaignId} screen="Organization Types" fieldName="Available in People Intake" />
                </span>
              </label>
            </div>
          </section>

          <div className="admin-users-drawer__actions">
            {selectedType ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm me-auto"
                onClick={() => void removeType(selectedType)}
                disabled={isSaving}
              >
                <i className="bi bi-trash3 me-2" aria-hidden="true" />
                Remove from Active Use
              </button>
            ) : null}
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeDrawer}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void saveType()}
              disabled={isSaving || !draft.label.trim()}
            >
              <i className="bi bi-floppy me-2" aria-hidden="true" />
              {selectedType ? 'Save Type' : 'Create Type'}
            </button>
          </div>
        </div>
      </AdminWorkspaceDrawer>
    </div>
  );
}

function OrganizationTypeStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`admin-campaign-ops-status ${isActive ? 'is-active' : 'is-inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function handleActionRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onSelect: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onSelect();
}
