export function AdminHealthStatusBanner({ overall }: { overall: string }) {
  const toneClass =
    overall === 'ok' || overall === 'healthy'
      ? 'is-ok'
      : overall === 'degraded'
        ? 'is-warn'
        : 'is-error';
  const label =
    overall === 'ok' || overall === 'healthy'
      ? 'System Healthy'
      : overall === 'degraded'
        ? 'Needs Attention'
        : 'System Unhealthy';

  return (
    <div className={`admin-health-banner ${toneClass}`}>
      <div>
        <div className="admin-health-banner__eyebrow">Runtime Health</div>
        <div className="admin-health-banner__title">{label}</div>
      </div>
      <div className="admin-health-banner__state">{overall}</div>
    </div>
  );
}
