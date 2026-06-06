import type { AdminHealthCheck } from '@/features/admin/model/adminTypes';

function statusLabel(status: string): string {
  if (status === 'ok' || status === 'healthy') return 'OK';
  if (status === 'degraded') return 'Degraded';
  return 'Error';
}

function statusClass(status: string): string {
  if (status === 'ok' || status === 'healthy') return 'is-ok';
  if (status === 'degraded') return 'is-warn';
  return 'is-error';
}

export function AdminHealthServiceCard({
  title,
  iconClass,
  check,
  metrics,
  action,
}: {
  title: string;
  iconClass: string;
  check: AdminHealthCheck;
  metrics: Array<{ label: string; value: string | number | null | undefined }>;
  action?: {
    label: string;
    iconClass: string;
    isBusy?: boolean;
    onClick: () => void;
  };
}) {
  return (
    <div className="content-card admin-health-card h-100">
      <div className="admin-health-card__header">
        <h2 className="admin-health-card__title">
          <i className={`bi ${iconClass}`} aria-hidden="true" />
          <span>{title}</span>
        </h2>
        <span className={`admin-health-card__status ${statusClass(check.status)}`}>
          {statusLabel(check.status)}
        </span>
      </div>

      <div className="admin-health-card__metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="admin-health-card__metric">
            <span className="admin-health-card__metric-label">{metric.label}</span>
            <span className="admin-health-card__metric-value">
              {metric.value == null || metric.value === '' ? '-' : String(metric.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="admin-health-card__detail">{check.message ?? 'No details reported.'}</div>
      {check.workers?.length ? (
        <div className="admin-health-card__meta">Workers: {check.workers.join(', ')}</div>
      ) : null}
      {check.expectedCollections?.length ? (
        <div className="admin-health-card__meta">Expected collections: {check.expectedCollections.join(', ')}</div>
      ) : null}
      {check.collections?.length ? (
        <div className="admin-health-card__meta">Available collections: {check.collections.join(', ')}</div>
      ) : null}
      {check.model ? <div className="admin-health-card__meta">Model: {check.model}</div> : null}
      {check.provider ? <div className="admin-health-card__meta">Provider: {check.provider}</div> : null}
      {check.url ? <div className="admin-health-card__meta">URL: {check.url}</div> : null}
      {check.path ? <div className="admin-health-card__meta">Path: {check.path}</div> : null}
      {action ? (
        <div className="mt-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={action.onClick} disabled={action.isBusy}>
            <i className={`bi ${action.iconClass} me-2`} aria-hidden="true" />
            {action.isBusy ? 'Working...' : action.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}
