# Active Workstreams

Last updated: 2026-05-20

## Current Phase

- Active roadmap phase: Phase 3
- Current step: schedule backend phase 1 is implemented; next step is replacing Studio `Dates` with `Schedule` and building `Timeline | Calendar | Milestones`

## Recently Completed

- Consolidated docs into a canonical set
- Added backend dependency manifests
- Verified backend lint and tests against the manifest-backed virtualenv
- Added backend `.env.example` and aligned setup/config naming with the reusable Query Forge pattern
- Documented the backend bootstrap flow around `requirements*.txt` and `.env.example`
- Removed the fake OTP local-login step so the frontend now matches the real backend local auth contract
- Completed OAuth callback handoff through the frontend and added reload-time session restoration via the refresh cookie
- Added a shared frontend API client with refresh-on-401 handling and auth-storage synchronization
- Fixed the backend `python app/main.py` entrypoint so it no longer fails on the local `app/celery.py` import shadowing issue
- Added RBAC design and implementation planning docs for campaign-scoped roles plus capability-based feature access
- Implemented RBAC foundation with campaign role persistence, a capability matrix, an authorization service, backend version.json, and backend tests
- Applied and verified the RBAC migration against the local MySQL `blessing_tree` database
- Implemented RBAC enforcement helpers for app-admin gating, campaign capability gating, and campaign scope resolution, with backend tests
- Documented the concrete campaign API design, AI-assisted campaign draft flow, and Campaign Studio direction
- Locked the remaining campaign design decisions: immediate `description`, expanded summary counts, and transient AI drafts
- Implemented the first campaign backend feature slice with protected list, detail, access, summary, create, and update endpoints
- Added and applied the campaign metadata migration to local MySQL, allowing `description` and multiple campaigns per year
- Exposed the first campaign APIs in the frontend through a campaign provider, campaign switcher, campaign list/detail routes, and a campaign-aware dashboard
- Documented Campaign Studio as a concrete card-based campaign-building surface with a persistent AI builder rail, team/communications/milestone/readiness cards, and a `/campaigns/:campaignId/studio` primary route
- Implemented Campaign Studio phase 1 with the primary studio route, left-rail section navigation, overview cards driven by existing campaign/access/summary data, placeholder section canvases, and a non-destructive AI builder rail
- Implemented Campaign Studio backend support with protected assignment, communication template/schedule, milestone, readiness, and aggregate studio endpoints
- Applied and verified the Campaign Studio support migration against the local MySQL `blessing_tree` database
- Live-smoke-tested the new Campaign Studio backend routes against the running Blessing Tree API
- Wired Campaign Studio Team, Communications, Dates, and Readiness sections to the new backend APIs
- Added frontend template and schedule creation flows inside Campaign Studio
- Added frontend milestone save wiring inside Campaign Studio
- Live-verified the Studio section rendering and communications create flows against the running Blessing Tree stack
- Added app-admin campaign creation UI on the campaign library page
- Added campaign update UI on the detail page and Studio settings section
- Live-verified the campaign create/update backend paths against the running Blessing Tree stack
- Added a campaign-scoped user directory search endpoint for Team assignment creation
- Wired Campaign Studio Team to search active users and create campaign assignments without raw IDs
- Live-verified the directory search and assignment creation flow against the running Blessing Tree backend
- Added a Vitest + Testing Library frontend test harness
- Added the first automated UI test coverage for the Campaign Studio Team assignment flow
- Locked frontend automated tests as mandatory for new UI behavior
- Documented concrete Campaign Schedule design with `campaign_event`, unified schedule reads, and `Timeline | Calendar | Milestones` Studio views
- Implemented backend `campaign_event` persistence and unified schedule APIs
- Applied and verified the `campaign_event` migration against local MySQL `blessing_tree`
- Added backend test coverage for manual event CRUD and unified schedule reads
- Fixed backend runtime gaps discovered during live stack verification:
  - removed the RBAC package import cycle at app startup
  - loaded the full SQLAlchemy model registry during app creation
  - pinned backend `bcrypt` to `4.1.3` so local password auth works with `passlib`
- Promoted additional coding rules into engineering policy for file size, single responsibility, version bumps, review, commit discipline, naming, and feature-driven backend structure
- Promoted additional delivery rules into engineering policy for migrations, backend-authoritative authz, additive APIs, shared-module scope, tests, and doc updates
- Initialized a single top-level Git repository with root `.gitignore` and `.gitattributes`

## Immediate Next Steps

1. Replace Studio `Dates` with `Schedule` and add `Timeline | Calendar | Milestones` views
2. Add manual event create/edit/delete UI inside the new Schedule section
3. Expand the next real domain slice into recipient groups, recipients, and wishlists

## Blockers Or Ambiguities

- Query Forge is a good source for auth/config patterns, but not all of its runtime surface belongs in Blessing Tree
