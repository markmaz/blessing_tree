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
  - Campaign Studio backend support now exists for assignments, communication templates, communication schedules, milestone dates, manual schedule events, unified schedule reads, readiness output, and aggregate studio payloads
  - backend startup now imports the full SQLAlchemy model registry during app creation
  - local auth compatibility now depends on `bcrypt 4.1.3` with `passlib 1.7.4`
  - runtime and dev dependency manifests now exist
  - checked-in `.env.example` now exists for local bootstrap
  - checked-in `version.json` now exists for backend build versioning
  - env/config naming is now aligned more closely with Query Forge for auth, Valkey, pool settings, and frontend base URL
- Frontend:
  - React + TypeScript + Vite
  - protected shell exists
  - campaign provider, top-bar switcher, campaign list page, and campaign detail page now exist
  - dashboard is now campaign-aware and loads live summary/access data from the backend
  - Campaign Studio now has live Team, Communications, Schedule, Readiness, and Settings sections backed by the backend studio APIs
  - Campaign Studio Schedule now includes `Timeline`, `Calendar`, and `Milestones` views plus manual planning event create/edit/delete
  - Campaign Studio AI rail now adapts prompt starters to schedule readiness gaps
  - Campaign Studio Team can now search active users and create campaign assignments directly from the frontend
  - Campaign Studio can now create communication templates and schedules from the frontend
  - Campaign Studio can now save milestone dates from the frontend
  - a Vitest + Testing Library harness now exists for automated frontend tests
  - app admins can now create campaigns from the campaign library UI
  - campaign managers and app admins can now update campaign metadata from the detail page and Studio settings section
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
  - `docs/engineering/campaign-schedule-design.md`

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
- Local stack verification:
  - Blessing Tree backend now boots correctly on port `5000`
  - Blessing Tree frontend now serves correctly on port `5173`
  - local login, refresh, logout, and protected campaign API routes were smoke-tested successfully against the running stack on 2026-05-20
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
- Campaign Studio backend support now exists:
  - `db/migration/V005__Campaign_Studio_Support.sql`
  - `db/migration/V006__Campaign_Schedule.sql`
  - `app/features/campaigns/studio_api.py`
  - `app/features/campaigns/studio_schedule_service.py`
  - `app/features/campaigns/studio_service.py`
  - `app/features/campaigns/studio_serializers.py`
  - `app/features/campaigns/studio_validation.py`
  - `app/features/campaigns/studio_constants.py`
- Local MySQL verification:
  - `V004__Campaign_Metadata.sql` has been applied to the local `blessing_tree` database
  - verified `campaign.description`
  - verified unique year constraint removal
  - verified non-unique `idx_campaign_year`
  - `V005__Campaign_Studio_Support.sql` has been applied to the local `blessing_tree` database
  - verified `communication_template`
  - verified `campaign_milestone`
  - verified `campaign_communication_schedule`
  - `V006__Campaign_Schedule.sql` has been applied to the local `blessing_tree` database
  - verified `campaign_event`
  - verified schedule indexes and foreign keys
- Current RBAC direction remains: minimal app roles, campaign-scoped assignments, code-defined capability bundles, and path-first campaign scope resolution.
- Frontend campaign routes now exist:
  - `/campaigns`
  - `/campaigns/:campaignId`
  - `/campaigns/:campaignId/studio`
  - selected campaign is persisted in local storage per user
- Frontend verification now includes:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Live frontend verification on 2026-05-20 now includes:
  - Studio Team section rendering real assignments
  - Studio Team assignment creation now verified against the running backend through the new directory search + assignment flow
  - Studio Communications section rendering real template/schedule state
  - Studio Communications section creating a template and schedule in-browser against the running backend
  - Studio Schedule section wiring to the unified schedule read APIs and milestone save path
  - Studio Schedule manual event create/edit/delete wiring to the new campaign event endpoints
  - Studio readiness now includes schedule-specific warnings for missing manual planning coverage and missing milestone-linked communication timing
  - Studio Readiness section rendering backend readiness findings
  - campaign create/update UI wiring against the existing backend campaign routes
- Live stack verification on 2026-05-20 now also includes:
  - `GET /api/v1/campaigns/<campaign_id>/studio`
  - `GET /api/v1/campaigns/<campaign_id>/assignments`
  - `GET /api/v1/campaigns/<campaign_id>/directory-users`
  - `GET /api/v1/campaigns/<campaign_id>/communications/templates`
  - `GET /api/v1/campaigns/<campaign_id>/communications/schedules`
  - backend test coverage now includes `GET /api/v1/campaigns/<campaign_id>/schedule`
  - backend test coverage now includes `GET|POST|PATCH|DELETE /api/v1/campaigns/<campaign_id>/events`
  - `GET /api/v1/campaigns/<campaign_id>/milestones`
  - `GET /api/v1/campaigns/<campaign_id>/readiness`
  - `POST /api/v1/campaigns`
  - `PATCH /api/v1/campaigns/<campaign_id>`
  - live readiness verification now confirms schedule-specific codes such as `missing_manual_schedule`

## Knowledge Graph

- Graph outputs live in `graphify-out/`.
- Previous graph run benchmarked at roughly 132.5x token reduction per query.

## Current Rule

- Ignore `files/` completely unless the user explicitly asks to bring it back into scope.
