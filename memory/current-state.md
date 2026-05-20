# Current State

Last updated: 2026-05-20

## Project Snapshot

- Root structure:
  - `blessing-tree-api/`
  - `blessing-tree-ui/`
  - `graphify-out/`
  - `files/` (ignored for active work)
- Backend:
  - Flask API
  - auth routes live
  - domain models and migrations exist
  - RBAC foundation now exists with campaign role persistence, capability bundles, and an authorization service
  - runtime and dev dependency manifests now exist
  - checked-in `.env.example` now exists for local bootstrap
  - checked-in `version.json` now exists for backend build versioning
  - env/config naming is now aligned more closely with Query Forge for auth, Valkey, pool settings, and frontend base URL
- Frontend:
  - React + TypeScript + Vite
  - protected shell exists
  - page shells exist for dashboard, families, donations, reports, and admin
  - shared authenticated client exists for future protected data APIs

## Current Runtime Facts

- Top-level project directory is now a Git repository rooted at `blessing_tree/`.
- Backend dependency manifests:
  - `blessing-tree-api/requirements.txt`
  - `blessing-tree-api/requirements-dev.txt`
- Backend build version file:
  - `blessing-tree-api/version.json`
- Backend env bootstrap:
  - `blessing-tree-api/.env.example`
- Canonical docs:
  - `README.md`
  - `ROADMAP.md`
  - `blessing-tree-api/README.md`
  - `blessing-tree-ui/README.md`
  - `docs/engineering/rbac-design.md`
  - `docs/engineering/rbac-implementation-plan.md`

## Auth Reality

- Frontend login calls `POST /api/v1/auth/local/login`.
- Frontend local login now completes directly and includes backend refresh-cookie handling.
- Frontend OAuth completion now uses `/auth/callback` plus `POST /api/v1/auth/refresh`.
- Frontend reload-time session restoration now uses the backend refresh cookie.
- Frontend shared API requests can now use a refresh-on-401 client layer.
- The documented backend entrypoint `python app/main.py` now reaches Flask startup correctly again.
- Backend auth routes currently cover:
  - local login
  - Google login/callback
  - Yahoo login/callback
  - refresh
  - logout
- Active-session automatic token refresh on 401 is now available through the shared frontend API client.
- RBAC foundation now exists:
  - `db/migration/V003__Campaign_User_Roles.sql`
  - `app/features/rbac/constants.py`
  - `app/features/rbac/models/campaign_user_role.py`
  - `app/features/rbac/services/authorization_service.py`
- Current RBAC direction remains: minimal app roles, campaign-scoped assignments, and code-defined capability bundles.

## Knowledge Graph

- Graph outputs live in `graphify-out/`.
- Previous graph run benchmarked at roughly 132.5x token reduction per query.

## Current Rule

- Ignore `files/` completely unless the user explicitly asks to bring it back into scope.
