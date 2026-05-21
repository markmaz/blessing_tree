export function ReportsPage() {
  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Reports</h1>
          <p className="text-muted mb-0">Measure impact with clear, printable summaries.</p>
        </div>
        <button className="btn btn-outline-primary btn-sm">
          <i className="bi bi-file-earmark-bar-graph me-2" aria-hidden="true" />
          Generate report
        </button>
      </div>

      <div className="content-card">
        <h2 className="h5 mb-3">Scheduled reports</h2>
        <ul className="list-unstyled mb-0">
          <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
            <span>Weekly outreach overview</span>
            <span className="text-muted small">Every Friday</span>
          </li>
          <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
            <span>Donation reconciliation</span>
            <span className="text-muted small">1st of month</span>
          </li>
          <li className="d-flex align-items-center justify-content-between py-2">
            <span>Volunteer engagement</span>
            <span className="text-muted small">Quarterly</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
