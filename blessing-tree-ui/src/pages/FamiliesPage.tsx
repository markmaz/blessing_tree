export function FamiliesPage() {
  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Families</h1>
          <p className="text-muted mb-0">Organize intake details, needs, and prayer requests.</p>
        </div>
        <button className="btn btn-primary btn-sm">Add family</button>
      </div>

      <div className="content-card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2 className="h5 mb-1">Recently updated</h2>
            <p className="text-muted mb-0">Placeholder table for family records.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm">Filter</button>
            <button className="btn btn-outline-primary btn-sm">Export</button>
          </div>
        </div>

        <div className="mt-4">
          <div className="alert alert-info mb-0">
            Families list will appear here once connected to the data source.
          </div>
        </div>
      </div>
    </div>
  );
}
