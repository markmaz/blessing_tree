export function DonationsPage() {
  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Donations</h1>
          <p className="text-muted mb-0">Track gifts and sponsorships with gratitude.</p>
        </div>
        <button className="btn btn-secondary btn-sm">Record donation</button>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Giving summary</h2>
            <p className="text-muted">
              A placeholder view for totals by fund, campaign, and distribution status.
            </p>
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge text-bg-light">General Fund</span>
              <span className="badge text-bg-light">Adopt-a-Family</span>
              <span className="badge text-bg-light">In-kind Gifts</span>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Recent gifts</h2>
            <div className="alert alert-warning mb-0">
              Connect the donations feed to see recent activity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
