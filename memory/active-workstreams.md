# Active Workstreams

Last updated: 2026-05-20

## Current Phase

- Active roadmap phase: Phase 3
- Current step: the Team redesign now has both a concrete design and a concrete implementation plan; the next step is Phase 1 backend roster foundation with `campaign_member`

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
- Wired Campaign Studio Team, Communications, Schedule, and Readiness sections to the new backend APIs
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
- Replaced Studio `Dates` with `Schedule` in the frontend and added `Timeline | Calendar | Milestones` views
- Added frontend manual event create/edit/delete flows on top of the unified schedule APIs
- Added frontend automated test coverage for the new Schedule section behavior
- Connected schedule quality into backend readiness with warnings for missing manual planning events and missing milestone-linked communication timing
- Connected the Studio AI rail to schedule readiness so schedule prompts are now contextual instead of generic
- Reworked Studio Schedule into a calendar-first planner with direct date-click and item-click modal editing
- Added shared modal editing for manual events, milestones, and communication schedules from the calendar surface
- Added a prompt-driven AI draft/apply path for schedule events, milestones, and communications
- Tightened Campaign Studio responsiveness by collapsing the section rail to icons at medium widths and preventing schedule/AI card content from bleeding outside their containers
- Reworked the AI draft-type picker in the Studio rail into a compact horizontal segmented control with shared helper copy so the narrow rail no longer chops the option text
- Reworked Studio Communications into a template-only builder with a saved-template rail, metadata/content editing tabs, and rendered email preview based on the Query Forge template-builder interaction pattern
- Expanded the Studio Communications builder to support heading, text, and image blocks through a persisted frontend block envelope, and made the saved-template rail collapsible so the editor has more room
- Tightened the Communications builder workspace spacing and added inline upload support for small embedded images inside email templates
- Reworked the Communications preview into a stronger rendered surface and moved merge fields into a slide-out drawer so the preview column has more room
- Reworked Communications again so merge fields now open from the builder side, the saved-template rail behaves more like a tool rail, and the Studio AI panel opens as a hidden right drawer instead of staying permanently visible
- Added a protected-app footer that displays `QueryForge, LLC` copyright plus live frontend/backend versions, backed by a new `/api/v1/meta/version` endpoint
- Documented the Campaign Team redesign: campaign roster separate from app users, fixed access roles for RBAC, user-defined teams for operations/email targeting, and a table-plus-drawer Team workspace
- Documented the Campaign Team implementation plan, including the incremental migration path from direct `campaign_user_role` assignments to a member-centric roster, team, and access-role model
- Added communication schedule delete support to the backend so the calendar modal can fully manage communication records
- Replaced remaining native browser confirmation dialogs in the schedule editors with custom in-app confirmation UI and promoted that as project policy
- Fixed backend runtime gaps discovered during live stack verification:
  - removed the RBAC package import cycle at app startup
  - loaded the full SQLAlchemy model registry during app creation
  - pinned backend `bcrypt` to `4.1.3` so local password auth works with `passlib`
- Promoted additional coding rules into engineering policy for file size, single responsibility, version bumps, review, commit discipline, naming, and feature-driven backend structure
- Promoted additional delivery rules into engineering policy for migrations, backend-authoritative authz, additive APIs, shared-module scope, tests, and doc updates
- Initialized a single top-level Git repository with root `.gitignore` and `.gitattributes`

## Immediate Next Steps

1. Implement Campaign Team phase 1 by adding the `campaign_member` backend foundation
2. After `campaign_member`, add the member-access-role transition layer so RBAC can move off direct `campaign_user_role` reads safely
3. Then add `campaign_team` and `campaign_team_member` before rewriting the Team Studio UI around the new aggregate APIs

## Blockers Or Ambiguities

- Query Forge is a good source for auth/config patterns, but not all of its runtime surface belongs in Blessing Tree
