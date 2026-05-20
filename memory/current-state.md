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
  - first campaign feature package now exists with protected list, detail, access, summary, create, and update routes
  - runtime and dev dependency manifests now exist
  - checked-in `.env.example` now exists for local bootstrap
  - checked-in `version.json` now exists for backend build versioning
  - env/config naming is now aligned more closely with Query Forge for auth, Valkey, pool settings, and frontend base URL
- Frontend:
  - React + TypeScript + Vite
  - protected shell exists
  - campaign provider, top-bar switcher, campaign list page, and campaign detail page now exist
  - dashboard is now campaign-aware and loads live summary/access data from the backend
  - page shells still exist for families, donations, reports, and admin
  - shared authenticated client exists for protected data APIs

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
  - `app/features/rbac/decorators.py`
  - `app/features/rbac/scope.py`
- Local MySQL verification:
  - `V003__Campaign_User_Roles.sql` has been applied to the local `blessing_tree` database
  - verified columns, indexes, and foreign keys for `campaign_user_role`
- Campaign API foundation now exists:
  - `db/migration/V004__Campaign_Metadata.sql`
  - `app/features/campaigns/api.py`
  - `app/features/campaigns/service.py`
  - `app/features/campaigns/serializers.py`
  - `app/features/campaigns/validation.py`
  - `app/features/campaigns/constants.py`
- Local MySQL verification:
  - `V004__Campaign_Metadata.sql` has been applied to the local `blessing_tree` database
  - verified `campaign.description`
  - verified unique year constraint removal
  - verified non-unique `idx_campaign_year`
- Current RBAC direction remains: minimal app roles, campaign-scoped assignments, code-defined capability bundles, and path-first campaign scope resolution.
- Frontend campaign routes now exist:
  - `/campaigns`
  - `/campaigns/:campaignId`
  - selected campaign is persisted in local storage per user

## Knowledge Graph

- Graph outputs live in `graphify-out/`.
- Previous graph run benchmarked at roughly 132.5x token reduction per query.

## Current Rule

- Ignore `files/` completely unless the user explicitly asks to bring it back into scope.
