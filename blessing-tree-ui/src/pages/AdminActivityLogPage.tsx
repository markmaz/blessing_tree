import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  fetchAdminAuditEventDetail,
  fetchAdminAuditEvents,
} from '@/features/admin/api/adminApi';
import type {
  AdminAuditEventDetail,
  AdminAuditEventFilters,
  AdminAuditEventListItem,
  AdminAuditEventsPayload,
} from '@/features/admin/model/adminTypes';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
import '@/features/admin/ui/adminUsers.css';
import '@/features/admin/ui/adminCampaignOperations.css';

interface AuditFilterDraft {
  search: string;
  area: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  pageSize: string;
}

const defaultFilters: AuditFilterDraft = {
  search: '',
  area: '',
  action: '',
  dateFrom: '',
  dateTo: '',
  pageSize: '25',
};

export function AdminActivityLogPage() {
  const [events, setEvents] = useState<AdminAuditEventListItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<AdminAuditEventsPayload['filters']>({
    areas: [],
    actions: [],
  });
  const [pagination, setPagination] = useState<AdminAuditEventsPayload['pagination']>({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [draftFilters, setDraftFilters] = useState<AuditFilterDraft>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AdminAuditEventFilters>({
    page: 1,
    pageSize: 25,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AdminAuditEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)),
    [pagination.pageSize, pagination.total]
  );
  const exportPayload = useMemo(
    () => ({
      title: 'Admin Activity Log',
      subtitle: buildExportSubtitle(appliedFilters, pagination, events.length),
      fileName: 'admin-activity-log',
      sheets: [
        {
          name: 'Activity',
          columns: [
            { key: 'occurredAt', label: 'When' },
            { key: 'user', label: 'User' },
            { key: 'email', label: 'Email' },
            { key: 'area', label: 'Area' },
            { key: 'action', label: 'Action' },
            { key: 'campaign', label: 'Campaign' },
            { key: 'recordType', label: 'Record Type' },
            { key: 'record', label: 'Record' },
            { key: 'summary', label: 'Summary' },
            { key: 'changedFields', label: 'Changed Fields' },
          ],
          rows: events.map((event) => ({
            occurredAt: formatDateTime(event.occurredAt),
            user: event.actor?.displayName ?? 'System',
            email: event.actor?.email ?? '',
            area: formatLabel(event.area),
            action: formatLabel(event.action),
            campaign: event.campaign?.name ?? 'Global',
            recordType: formatLabel(event.entityType),
            record: event.entityLabel ?? '',
            summary: event.summary,
            changedFields: event.changeCount,
          })),
        },
      ],
    }),
    [appliedFilters, events, pagination]
  );

  useEffect(() => {
    let isActive = true;
    async function loadEvents() {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchAdminAuditEvents(appliedFilters);
        if (isActive) {
          setEvents(payload.items);
          setPagination(payload.pagination);
          setFilterOptions(payload.filters);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load activity log.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    void loadEvents();
    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null);
      return;
    }

    let isActive = true;
    const eventId = selectedEventId;
    async function loadDetail() {
      setIsDetailLoading(true);
      setDetailError(null);
      try {
        const payload = await fetchAdminAuditEventDetail(eventId);
        if (isActive) {
          setSelectedEvent(payload.event);
        }
      } catch (loadError) {
        if (isActive) {
          setDetailError(loadError instanceof Error ? loadError.message : 'Unable to load activity details.');
        }
      } finally {
        if (isActive) {
          setIsDetailLoading(false);
        }
      }
    }
    void loadDetail();
    return () => {
      isActive = false;
    };
  }, [selectedEventId]);

  function applyFilters(page = 1) {
    setAppliedFilters({
      page,
      pageSize: Number.parseInt(draftFilters.pageSize, 10) || 25,
      search: draftFilters.search.trim() || undefined,
      area: draftFilters.area || undefined,
      action: draftFilters.action || undefined,
      dateFrom: draftFilters.dateFrom || undefined,
      dateTo: draftFilters.dateTo || undefined,
    });
  }

  function clearFilters() {
    setDraftFilters(defaultFilters);
    setAppliedFilters({ page: 1, pageSize: 25 });
  }

  function openEvent(event: AdminAuditEventListItem) {
    setSelectedEventId(event.id);
    setSelectedEvent(null);
    setDetailError(null);
  }

  function closeDrawer() {
    setSelectedEventId(null);
    setSelectedEvent(null);
    setDetailError(null);
  }

  return (
    <section className="admin-campaign-ops">
      <div className="campaign-studio-page__header">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">Admin</span>
            <span className="campaign-chip campaign-chip-muted">Activity Log</span>
          </div>
          <h1 className="h3 mb-1">Activity Log</h1>
          <p className="text-muted mb-0">
            Review recent changes across users, campaigns, people, sponsors, gifts, and communications.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <ReportExportActions payload={exportPayload} disabled={isLoading || events.length === 0} />
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => applyFilters(pagination.page)}
            disabled={isLoading}
          >
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label" htmlFor="audit-search">
              Search
            </label>
            <div className="admin-users-toolbar__search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                id="audit-search"
                className="form-control"
                value={draftFilters.search}
                placeholder="Search summary, user, or changed item"
                onChange={(event) =>
                  setDraftFilters((currentValue) => ({
                    ...currentValue,
                    search: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyFilters();
                  }
                }}
              />
            </div>
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <label className="form-label" htmlFor="audit-area">
              Area
            </label>
            <select
              id="audit-area"
              className="form-select"
              value={draftFilters.area}
              onChange={(event) =>
                setDraftFilters((currentValue) => ({
                  ...currentValue,
                  area: event.target.value,
                }))
              }
            >
              <option value="">All areas</option>
              {filterOptions.areas.map((area) => (
                <option key={area} value={area}>
                  {formatLabel(area)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <label className="form-label" htmlFor="audit-action">
              Action
            </label>
            <select
              id="audit-action"
              className="form-select"
              value={draftFilters.action}
              onChange={(event) =>
                setDraftFilters((currentValue) => ({
                  ...currentValue,
                  action: event.target.value,
                }))
              }
            >
              <option value="">All actions</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>
                  {formatLabel(action)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <label className="form-label" htmlFor="audit-date-from">
              From
            </label>
            <input
              id="audit-date-from"
              type="date"
              className="form-control"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((currentValue) => ({
                  ...currentValue,
                  dateFrom: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <label className="form-label" htmlFor="audit-date-to">
              To
            </label>
            <input
              id="audit-date-to"
              type="date"
              className="form-control"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((currentValue) => ({
                  ...currentValue,
                  dateTo: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <label className="form-label" htmlFor="audit-page-size">
              Rows
            </label>
            <select
              id="audit-page-size"
              className="form-select"
              value={draftFilters.pageSize}
              onChange={(event) =>
                setDraftFilters((currentValue) => ({
                  ...currentValue,
                  pageSize: event.target.value,
                }))
              }
            >
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>
          <div className="col-12 col-lg-10">
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => applyFilters()}>
                <i className="bi bi-funnel me-2" aria-hidden="true" />
                Apply Filters
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <div className="content-card admin-campaign-ops-table-card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">Recent Activity</h2>
            <p className="text-muted mb-0">
              Showing {events.length} of {pagination.total} recorded events.
            </p>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Activity log pages">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => applyFilters(pagination.page - 1)}
            >
              Previous
            </button>
            <span className="btn btn-outline-secondary disabled">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={pagination.page >= totalPages || isLoading}
              onClick={() => applyFilters(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
        {isLoading ? (
          <p className="text-muted mb-0">Loading activity...</p>
        ) : events.length === 0 ? (
          <p className="text-muted mb-0">No activity matches these filters.</p>
        ) : (
          <div className="table-responsive">
            <table className="table admin-campaign-ops-table align-middle mb-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Area</th>
                  <th>Action</th>
                  <th>Campaign</th>
                  <th>What Changed</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View activity ${event.summary}`}
                    className="admin-campaign-ops-action-row"
                    onClick={() => openEvent(event)}
                    onKeyDown={(keyEvent) => handleActionRowKeyDown(keyEvent, () => openEvent(event))}
                  >
                    <td>{formatDateTime(event.occurredAt)}</td>
                    <td>
                      <div className="fw-semibold">{event.actor?.displayName ?? 'System'}</div>
                      {event.actor?.email ? <div className="text-muted small">{event.actor.email}</div> : null}
                    </td>
                    <td>
                      <span className="badge text-bg-light">{formatLabel(event.area)}</span>
                    </td>
                    <td>{formatLabel(event.action)}</td>
                    <td>{event.campaign?.name ?? <span className="text-muted">Global</span>}</td>
                    <td>
                      <div className="fw-semibold">{event.summary}</div>
                      <div className="text-muted small">
                        {event.entityLabel ?? formatLabel(event.entityType)}
                        {event.changeCount ? ` - ${event.changeCount} changed field${event.changeCount === 1 ? '' : 's'}` : ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminWorkspaceDrawer
        isOpen={Boolean(selectedEventId)}
        title="Activity Details"
        description="Review who changed the record, when it happened, and the captured before and after values."
        onClose={closeDrawer}
        width="wide"
      >
        {isDetailLoading ? <p className="text-muted mb-0">Loading activity details...</p> : null}
        {detailError ? <div className="alert alert-danger py-2">{detailError}</div> : null}
        {selectedEvent ? <ActivityEventDetail event={selectedEvent} /> : null}
      </AdminWorkspaceDrawer>
    </section>
  );
}

function ActivityEventDetail({ event }: { event: AdminAuditEventDetail }) {
  return (
    <div className="admin-users-drawer__stack">
      <section className="admin-users-drawer__section">
        <div className="admin-users-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Summary</h4>
            <p className="text-muted small mb-0">{event.summary}</p>
          </div>
          <span className="badge text-bg-light">{formatLabel(event.action)}</span>
        </div>
        <dl className="admin-users-detail-grid mb-0">
          <div>
            <dt className="text-muted small">When</dt>
            <dd>{formatDateTime(event.occurredAt)}</dd>
          </div>
          <div>
            <dt className="text-muted small">User</dt>
            <dd>
              {event.actor?.displayName ?? 'System'}
              {event.actor?.email ? <span className="text-muted d-block small">{event.actor.email}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted small">Area</dt>
            <dd>{formatLabel(event.area)}</dd>
          </div>
          <div>
            <dt className="text-muted small">Campaign</dt>
            <dd>{event.campaign?.name ?? 'Global'}</dd>
          </div>
          <div>
            <dt className="text-muted small">Record</dt>
            <dd>{event.entityLabel ?? formatLabel(event.entityType)}</dd>
          </div>
          <div>
            <dt className="text-muted small">Record Type</dt>
            <dd>{formatLabel(event.entityType)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-users-drawer__section">
        <div className="admin-users-drawer__section-header">
          <div>
            <h4 className="h6 mb-1">Changes</h4>
            <p className="text-muted small mb-0">
              Sensitive fields are redacted before they are stored in the log.
            </p>
          </div>
        </div>
        {event.changeSet.length === 0 ? (
          <p className="text-muted mb-0">No field-level changes were captured for this event.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {event.changeSet.map((change) => (
                  <tr key={change.field}>
                    <td className="fw-semibold">{change.label || formatLabel(change.field)}</td>
                    <td>{formatValue(change.before)}</td>
                    <td>{formatValue(change.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-users-drawer__section">
        <details>
          <summary className="fw-semibold">Technical Details</summary>
          <dl className="admin-users-detail-grid mt-3 mb-0">
            <div>
              <dt className="text-muted small">IP Address</dt>
              <dd>{event.ipAddress ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-muted small">Correlation ID</dt>
              <dd className="text-break">{event.correlationId ?? '-'}</dd>
            </div>
            <div className="admin-campaign-ops-form__span-2">
              <dt className="text-muted small">User Agent</dt>
              <dd className="text-break">{event.userAgent ?? '-'}</dd>
            </div>
            <div className="admin-campaign-ops-form__span-2">
              <dt className="text-muted small">Metadata</dt>
              <dd className="text-break">
                <code>{JSON.stringify(event.metadata ?? {}, null, 2)}</code>
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  );
}

function handleActionRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

function formatLabel(value: string): string {
  if (!value) {
    return '-';
  }
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function buildExportSubtitle(
  filters: AdminAuditEventFilters,
  pagination: AdminAuditEventsPayload['pagination'],
  loadedCount: number
): string {
  const parts = [
    filters.search ? `Search: ${filters.search}` : null,
    filters.area ? `Area: ${formatLabel(filters.area)}` : null,
    filters.action ? `Action: ${formatLabel(filters.action)}` : null,
    filters.dateFrom ? `From: ${filters.dateFrom}` : null,
    filters.dateTo ? `To: ${filters.dateTo}` : null,
  ].filter(Boolean);
  const resultSummary = `Showing ${loadedCount} of ${pagination.total} events, page ${pagination.page} of ${Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}.`;
  return parts.length ? `${resultSummary} ${parts.join(' | ')}` : resultSummary;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}
