/**
 * HomePage
 * Placeholder home page after successful authentication.
 */

import './HomePage.css';

export function HomePage() {
  return (
    <div className="home-page">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          {/* Welcome Section */}
          <div className="card card-welcome mb-4">
            <div className="card-body">
              <h1 className="card-title">Welcome to Blessing Tree</h1>
              <p className="card-text fs-5 text-muted">
                This is your home page. You have successfully authenticated and can now access the application.
              </p>
            </div>
          </div>

          {/* Features Overview */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="card card-feature h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-shield-check me-2" />
                    Secure Authentication
                  </h5>
                  <p className="card-text small">
                    Login with local credentials or approved OAuth providers.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card card-feature h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-palette me-2" />
                    Beautiful Design
                  </h5>
                  <p className="card-text small">
                    Modern, clean UI with Bootstrap 5 and a warm, inviting color palette.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card card-feature h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-puzzle me-2" />
                    Modular Structure
                  </h5>
                  <p className="card-text small">
                    Feature-based folder organization makes it easy to scale and maintain.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card card-feature h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-code-slash me-2" />
                    TypeScript + React
                  </h5>
                  <p className="card-text small">
                    Built with modern web technologies for type safety and developer experience.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="card card-next-steps mt-4">
            <div className="card-body">
              <h5 className="card-title mb-3">Next Steps</h5>
              <ul className="list-group list-group-flush">
                <li className="list-group-item">
                  Build new data clients on top of <code>src/shared/api/client.ts</code>
                </li>
                <li className="list-group-item">
                  Customize theme colors in <code>src/styles/theme.css</code>
                </li>
                <li className="list-group-item">
                  Add your feature pages under <code>src/pages/</code> or <code>src/features/</code>
                </li>
                <li className="list-group-item">
                  Register new routes in the router configuration
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
