export function DashboardPage() {
  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Dashboard</h1>
          <p className="text-muted mb-0">A quiet overview of today&apos;s ministry activity.</p>
        </div>
        <button className="btn btn-secondary btn-sm">
          Start a new family record
        </button>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-uppercase small text-muted mb-1">Families Served</p>
                  <h3 className="mb-0">128</h3>
                </div>
                <i className="bi bi-people fs-2 text-muted" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-uppercase small text-muted mb-1">Donations This Week</p>
                  <h3 className="mb-0">$9,240</h3>
                </div>
                <i className="bi bi-cash-stack fs-2 text-muted" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-uppercase small text-muted mb-1">Pending Requests</p>
                  <h3 className="mb-0">14</h3>
                </div>
                <i className="bi bi-clipboard-check fs-2 text-muted" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-uppercase small text-muted mb-1">Volunteers</p>
                  <h3 className="mb-0">36</h3>
                </div>
                <i className="bi bi-heart fs-2 text-muted" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-7">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">This week&apos;s focus</h2>
            <p className="mb-3">
              Encourage teams to complete family intake calls and log gift matches before Sunday.
            </p>
            <div className="d-flex align-items-center gap-3">
              <span className="badge text-bg-light">8 families awaiting pairing</span>
              <span className="badge text-bg-light">3 follow-ups scheduled</span>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Upcoming milestones</h2>
            <ul className="list-unstyled mb-0">
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>Family handoff meeting - Tuesday 10:00 AM</span>
              </li>
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>Volunteer orientation - Thursday 6:30 PM</span>
              </li>
              <li className="d-flex align-items-start gap-2">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>Distribution weekend preparation - Friday 3:00 PM</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
