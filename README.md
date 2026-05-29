# Blessing Tree

Blessing Tree is a split frontend/backend application for managing a church gifting program.

## Current Status

- `blessing-tree-api/` is a Flask API with authentication, SQLAlchemy models, MySQL migrations, Celery-backed campaign automation, Valkey-backed audit logging, the RBAC foundation, Campaign Studio backend APIs, a refined recipient-domain foundation with new `People` workspace APIs, and an admin runtime slice for invitations, LLM configuration, health, and feature flags.
- `blessing-tree-ui/` is a React 19 + TypeScript + Vite frontend with a protected app shell, Campaign Studio, a working admin workspace, and Playwright-backed browser E2E coverage for critical flows.
- `files/` is legacy/reference material and is not part of the active application surface. Ignore it for normal development work.

## Important Reality Check

- The frontend and backend are partially integrated, but auth is not fully finished yet.
- `blessing-tree-ui/src/shared/api/authApi.ts` calls the real backend local login route.
- Local login now completes directly against the backend auth routes.
- OAuth callbacks now round-trip through the backend, set the refresh cookie, and complete in the frontend callback route.
- Reload-time session restoration now uses the backend refresh cookie.
- The frontend now has a shared authenticated API client with refresh-on-401 handling for future data screens.
- The frontend now has a campaign switcher, campaign library, campaign detail flow, and a dashboard that follows the selected campaign.
- The frontend now has a live Campaign Studio at `/campaigns/:campaignId/studio` with Team, Communications, Schedule, Readiness, and Settings sections backed by the new backend studio APIs.
- The admin area now supports Query Forge-style user invitations, global LLM configuration, runtime health checks for database/Celery/LLM, and app feature enable/disable controls.
- Campaign Studio AI now uses the configured admin LLM first for draft generation and falls back to the deterministic rules engine when the LLM is missing, disabled, unavailable, or returns an invalid structured draft.
- The admin user-management area now uses a Query Forge-style workspace with a searchable/sortable user table, row actions, and drawers for invite/create and user details.
- Admins can now also activate and deactivate users directly from the user-management row action menu.
- Generic Google/Yahoo sign-in is now restricted to already-linked returning users, while invitation onboarding now lets invited users choose Google, Yahoo, or a local password from the invite page.
- Invitation validation now distinguishes pending vs already-accepted onboarding state, and the invite/callback UI now shows clearer completion and error messaging.
- The Communications section is now template-only and uses a Query Forge-inspired template-builder workspace with a collapsible tool rail, heading/text/image content blocks, inline uploads for small embedded images such as maps, a builder-side merge-field drawer, and a stronger rendered-preview surface; the Studio AI panel is now hidden by default and opens as a right-side drawer when needed.
- The Schedule section is now calendar-first, with a Calendar Intelligence overview, critical date strip, warning list, and direct date-click and item-click modal editing for manual events, milestones, and communication schedules on top of the unified backend schedule APIs.
- Ask Blessing Tree and the Dashboard now reuse the same calendar intelligence service for campaign date questions, upcoming calendar events, missing blockers, follow-up due items, and scheduled communications.
- Schedule readiness now flags missing manual planning events and missing communication timing for key milestones, and the AI rail now surfaces schedule-aware prompt starters from those gaps.
- The Team section in Campaign Studio is now a member-centric workspace with a campaign roster table, custom teams, fixed access-role management, optional app-access linking, and Query Forge-style edit drawers.
- The frontend now also has campaign admin create/update UI on top of the existing campaign backend routes.
- The frontend now has a Vitest + Testing Library harness, and automated frontend tests are required for new UI behavior.
- The backend now also supports manual campaign events and unified schedule reads for the next Campaign Studio `Schedule` phase.
- The backend now has checked-in dependency manifests, an `.env.example`, the RBAC foundation layer, reusable RBAC enforcement helpers, and Campaign Studio backend support, but the broader app is still in stabilization rather than feature delivery.
- The backend now also has a real automation execution layer for scheduled communications and campaign lifecycle transitions, including Celery worker/beat wiring, execution logs, worker heartbeat, and readiness signals for worker health and failed runs.
- Local outbound email is now operational in development through a repo-owned SMTP sink, so invitation emails and scheduled communication dispatch can be exercised end to end without external SMTP credentials.
- The browser regression layer now includes Playwright E2E coverage for invite onboarding, campaign cloning, and the communications builder.

## Project Layout

```text
blessing_tree/
├── blessing-tree-api/
├── blessing-tree-ui/
├── graphify-out/
├── memory.md
└── ROADMAP.md
```

## Docs

- [memory.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/memory.md): project memory, continuity rules, and running notes
- [ROADMAP.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/ROADMAP.md): implementation roadmap
- [blessing-tree-api/README.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/blessing-tree-api/README.md): backend overview, routes, setup notes
- [blessing-tree-ui/README.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/blessing-tree-ui/README.md): frontend overview, routes, setup notes
- [docs/deployment/ec2-docker-compose.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/docs/deployment/ec2-docker-compose.md): preferred Docker Compose deployment on EC2 with RDS MySQL
- [docs/deployment/ec2-github-actions.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/docs/deployment/ec2-github-actions.md): GitHub Actions deployment to EC2
- [graphify-out/GRAPH_REPORT.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/graphify-out/GRAPH_REPORT.md): knowledge graph report

## Frontend

From `blessing-tree-ui/`:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

The frontend expects `VITE_API_BASE_URL`, defaulting to `http://localhost:5000`.

## Backend

Backend entry point:

```bash
python app/main.py
```

Install backend dependencies from:

```text
blessing-tree-api/requirements.txt
blessing-tree-api/requirements-dev.txt
```

Bootstrap backend environment from:

```text
blessing-tree-api/.env.example
```

Helper scripts from `blessing-tree-api/`:

```bash
scripts/test.sh
scripts/lint.sh
scripts/coverage.sh
./.venv/bin/python scripts/dev_smtp_sink.py
```

Celery processes from `blessing-tree-api/`:

```bash
./.venv/bin/python -m celery -A app.celery worker --loglevel=INFO
./.venv/bin/python -m celery -A app.celery beat --loglevel=INFO --schedule=/tmp/blessing-tree-celerybeat-schedule
```

See the backend README for current env var requirements and auth route details.
