import { useEffect, useState } from 'react';
import { useAdminHealth } from '@/features/admin/model/useAdminHealth';
import { AdminHealthServiceCard } from '@/features/admin/ui/AdminHealthServiceCard';
import { AdminHealthStatusBanner } from '@/features/admin/ui/AdminHealthStatusBanner';

export function AdminHealthPage() {
  const { health, error, isLoading, lastChecked, refreshNow } = useAdminHealth();
  const [now, setNow] = useState(() => Date.now());
  const secondsAgo = Math.round((now - lastChecked) / 1000);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return <div className="content-card">Loading runtime health…</div>;
  }

  if (error) {
    return (
      <div className="content-card">
        <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3 mb-0">
          <span>{error}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refreshNow()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="content-card">
        <div className="text-muted">No runtime health data is available yet.</div>
      </div>
    );
  }

  return (
    <div className="vstack gap-4">
      <AdminHealthStatusBanner overall={health.overall} />

      <div className="content-card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="text-muted">
            Last checked <strong>{secondsAgo}s ago</strong>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void refreshNow()}>
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
            Refresh Now
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <AdminHealthServiceCard
            title="Database"
            iconClass="bi-database"
            check={health.checks.database}
            metrics={[
              { label: 'Status', value: health.checks.database.status },
              { label: 'Latency', value: health.checks.database.latencyMs != null ? `${health.checks.database.latencyMs} ms` : '-' },
            ]}
          />
        </div>
        <div className="col-12 col-xl-4">
          <AdminHealthServiceCard
            title="Celery"
            iconClass="bi-diagram-3"
            check={health.checks.celery}
            metrics={[
              { label: 'Status', value: health.checks.celery.status },
              { label: 'Heartbeat', value: health.checks.celery.workerHeartbeat ? 'Online' : 'Missing' },
              { label: 'Workers', value: health.checks.celery.workers?.length ?? 0 },
            ]}
          />
        </div>
        <div className="col-12 col-xl-4">
          <AdminHealthServiceCard
            title="LLM"
            iconClass="bi-cpu"
            check={health.checks.llm}
            metrics={[
              { label: 'Status', value: health.checks.llm.status },
              { label: 'Configured', value: health.checks.llm.configured ? 'Yes' : 'No' },
              { label: 'Model', value: health.checks.llm.model ?? '-' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
