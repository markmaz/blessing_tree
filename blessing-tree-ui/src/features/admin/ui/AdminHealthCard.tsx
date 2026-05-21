import { useEffect, useState } from 'react';
import { fetchAdminHealth } from '@/features/admin/api/adminApi';
import type { AdminHealthPayload } from '@/features/admin/model/adminTypes';

export function AdminHealthCard() {
  const [health, setHealth] = useState<AdminHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setHealth(await fetchAdminHealth());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load runtime health.');
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextHealth = await fetchAdminHealth();
        if (active) {
          setHealth(nextHealth);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load runtime health.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="content-card h-100">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Runtime Health</h2>
          <p className="text-muted mb-0">Monitor database, Celery, and LLM availability.</p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {!health ? (
        <p className="text-muted mb-0">Loading health checks...</p>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <HealthPill label="Overall" value={health.overall} />
            <HealthPill label="Database" value={health.checks.database.status} />
            <HealthPill label="Celery" value={health.checks.celery.status} />
            <HealthPill label="LLM" value={health.checks.llm.status} />
          </div>
          <div className="vstack gap-3">
            <HealthDetail label="Database" value={health.checks.database.message ?? 'Healthy'} />
            <HealthDetail
              label="Celery"
              value={health.checks.celery.message ?? 'Healthy'}
              extra={health.checks.celery.workers?.length ? `Workers: ${health.checks.celery.workers.join(', ')}` : undefined}
            />
            <HealthDetail
              label="LLM"
              value={health.checks.llm.message ?? 'Healthy'}
              extra={health.checks.llm.model ? `Model: ${health.checks.llm.model}` : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

function HealthPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="border rounded-3 p-3 bg-white h-100">
        <div className="text-uppercase small text-muted">{label}</div>
        <div className="fw-semibold mt-1">{value}</div>
      </div>
    </div>
  );
}

function HealthDetail({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="border rounded-3 p-3 bg-white">
      <div className="fw-semibold">{label}</div>
      <div className="text-muted">{value}</div>
      {extra ? <div className="small mt-1">{extra}</div> : null}
    </div>
  );
}
