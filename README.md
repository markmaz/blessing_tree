# Blessing Tree

Blessing Tree is a split frontend/backend application for managing a church gifting program.

## Current Status

- `blessing-tree-api/` is a Flask API with authentication, SQLAlchemy models, MySQL migrations, Celery wiring, Valkey-backed audit logging, the RBAC foundation, and Campaign Studio backend APIs for assignments, communications, milestones, schedule events, and readiness.
- `blessing-tree-ui/` is a React 19 + TypeScript + Vite frontend with a protected app shell and placeholder pages for dashboard, families, donations, reports, and admin.
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
- The Communications section is now template-only and uses a Query Forge-inspired template-builder workspace with a collapsible tool rail, heading/text/image content blocks, inline uploads for small embedded images such as maps, a builder-side merge-field drawer, and a stronger rendered-preview surface; the Studio AI panel is now hidden by default and opens as a right-side drawer when needed.
- The Schedule section is now calendar-first, with direct date-click and item-click modal editing for manual events, milestones, and communication schedules on top of the unified backend schedule APIs.
- Schedule readiness now flags missing manual planning events and missing communication timing for key milestones, and the AI rail now surfaces schedule-aware prompt starters from those gaps.
- The Team section in Campaign Studio is now a member-centric workspace with a campaign roster table, custom teams, fixed access-role management, optional app-access linking, and Query Forge-style edit drawers.
- The frontend now also has campaign admin create/update UI on top of the existing campaign backend routes.
- The frontend now has a Vitest + Testing Library harness, and automated frontend tests are required for new UI behavior.
- The backend now also supports manual campaign events and unified schedule reads for the next Campaign Studio `Schedule` phase.
- The backend now has checked-in dependency manifests, an `.env.example`, the RBAC foundation layer, reusable RBAC enforcement helpers, and Campaign Studio backend support, but the broader app is still in stabilization rather than feature delivery.

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
- [graphify-out/GRAPH_REPORT.md](/Users/mmaslak/Local%20Documents/projects/blessing_tree/graphify-out/GRAPH_REPORT.md): knowledge graph report

## Frontend

From `blessing-tree-ui/`:

```bash
npm run dev
npm run build
npm run lint
npm run test
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
```

See the backend README for current env var requirements and auth route details.
