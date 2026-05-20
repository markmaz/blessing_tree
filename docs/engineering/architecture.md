# Architecture

## Current Shape

- `blessing-tree-api/`
  - Flask app factory in `app/factory.py`
  - auth routes in `app/routes/auth_routes.py`
  - SQLAlchemy models in `app/models/`
  - MySQL migrations in `db/migration/`
  - Celery and Valkey integration
- `blessing-tree-ui/`
  - router in `src/app/App.tsx`
  - protected app shell in `src/shared/ui/layout/AppLayout.tsx`
  - auth flow under `src/features/auth/`
  - page shells for dashboard, families, donations, reports, and admin

## Important Current Architectural Reality

- Auth is only partially aligned end to end.
- The backend exposes login, refresh, logout, and OAuth routes.
- The frontend local login path now matches the backend contract.
- OAuth callback completion is now wired through a frontend callback route that restores the access token from the refresh cookie.
- Reload-time session bootstrap now uses the backend refresh route.

## Intended Near-Term Direction

- Stabilize backend setup and environment reproducibility.
- Add active-session token refresh handling as real API screens are introduced.
- Build the first real domain slice around campaigns, recipient groups, recipients, and wishlists.
