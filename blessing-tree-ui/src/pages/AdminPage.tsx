export function AdminPage() {
  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Admin</h1>
          <p className="text-muted mb-0">Manage users, roles, and program settings.</p>
        </div>
        <button className="btn btn-primary btn-sm">Invite admin</button>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Access roles</h2>
            <p className="text-muted">
              Define permissions for coordinators, volunteers, and finance teams.
            </p>
            <button className="btn btn-outline-primary btn-sm">Edit roles</button>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Season settings</h2>
            <p className="text-muted">
              Control registration windows, deadlines, and distribution dates.
            </p>
            <button className="btn btn-outline-primary btn-sm">
              Update settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
