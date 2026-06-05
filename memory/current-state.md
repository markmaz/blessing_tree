# Current State

Last updated: 2026-06-04

## Project Snapshot

Blessing Tree is a campaign-centered Flask/MySQL/Celery backend with a
React/TypeScript/Vite frontend. The product now has working campaign setup,
people intake, sponsor operations, gift workflow, campaign communications,
Ask Blessing Tree, admin runtime tools, deployment support, and user
documentation.

Top-level structure:

- `blessing-tree-api/` - Flask API, SQLAlchemy models, migrations, Celery tasks.
- `blessing-tree-ui/` - React/Vite frontend.
- `docs/engineering/` - durable design and implementation documents.
- `docs/user-guide/` - generated user guide source, screenshots, DOCX, and PDF.
- `memory/` - short-lived operational memory.
- `deploy/`, `docker-compose*.yml`, and GitHub Actions deployment assets for EC2/Docker.

## Backend Reality

- Auth supports local login, password reset, refresh-cookie sessions, invitation
  onboarding, and account/profile settings.
- Generic Google/Yahoo sign-in has been removed from the normal sign-in screen
  because the target users found it confusing. Invitation/OAuth code may still
  exist historically, but local account/password onboarding is the current user
  path.
- RBAC and campaign access are implemented with app-admin privileges plus
  campaign-scoped screen/capability access. Admin User Management now uses a
  fine-grained toggle grid for People, Sponsors, Gifts, Campaigns, Reports,
  Ask Blessing Tree, and Admin-related access.
- Campaign Studio backend supports campaign settings, team/roster management,
  communication templates, communication schedules, send history, flyer
  templates, gift policy, milestones, readiness rules, calendar intelligence,
  and AI draft/action support.
- Admin Campaign Operations manages dynamic milestone definitions and readiness
  rules. Seeded readiness blockers include sponsor recruitment start/end,
  gift turn-in/due-date style blockers, and other campaign policy-driven checks.
- Celery worker/beat support scheduled communications, lifecycle/automation
  tasks, execution logging, and health/readiness reporting through the `bt`
  queue.
- People/recipient APIs support household/family intake, organization intake,
  organization types, families associated to organizations, children/adults,
  wishlist items, duplicate protection, program abbreviations, generated
  recipient IDs where needed, and workflow rollups.
- Sponsor APIs support campaign-scoped sponsor records, interaction logs,
  public self-registration, verified gift reservation, sponsor reminder sends,
  campaign communication recipients, and sponsor reports.
- Gift APIs support hybrid natural-language gift search, optional Qdrant-backed
  semantic candidate retrieval, reservations/commitments, operations status
  changes, gift pool inventory, gift status reports, public QR scan actions,
  gift tag templates, batch/manual tag printing, reminder rules, and gift
  policy rules. SQL remains the final authority for campaign scope,
  availability, and authorization when semantic search is enabled.
- Recipient and wishlist-item mutations enqueue Celery/Valkey semantic gift
  reindex jobs for Qdrant so normal data entry keeps the gift search index
  fresh. The Admin Health Check Qdrant action remains the manual full rebuild.
- Ask Blessing Tree has deterministic help/navigation/report handling, optional
  LLM-assisted entity extraction, optional Qdrant-backed knowledge retrieval,
  prompt logging/review, thumbs up/down feedback, field-level help, and reusable
  campaign calendar intelligence. Seeded Ask knowledge includes current gift
  search/commit/release/sponsor-drawer workflows, Qdrant gift search behavior,
  and People Directory print/export, program-filter, expansion, recipient-ID,
  gift-detail, and sponsor-detail guidance.
- Admin Activity Log is implemented with durable `audit_event` storage,
  app-admin list/detail APIs, event writers across high-value admin/campaign
  workflows, row detail drawers, filters, pagination, and PDF/Excel export.
- Report export helpers now generate real PDFs, true `.xlsx` workbooks, and
  CSV files.
- Current migrations run through `V045__Audit_Event_Log.sql`.

## Frontend Reality

- The protected app shell has a campaign switcher, sidebar navigation, footer
  version display, and scrollable left navigation for expanded menus.
- Dashboard is campaign-aware and shows operational widgets, upcoming calendar
  events, Ask shortcuts, and moved-lower campaign snapshot/readiness sections.
- Ask Blessing Tree is a conversational page and is also used by field-level
  help dialogs. It can answer help/navigation questions and campaign-data
  questions such as gift counts, unsponsored gifts, calendar dates, and
  follow-up items.
- Campaign Studio is the primary campaign control surface with overview,
  settings, team, communications, schedule/calendar intelligence, readiness,
  flyer builder, gift policy, and AI assistant panel. The Studio AI panel now
  uses an Ask-like conversational interface and Blessing Tree styling.
- Flyer Builder uses a free/open-source Konva-style canvas approach. Users can
  place text/images, preview, and save campaign flyer templates.
- Gift Tag Builder exists under campaign/gift tooling. It supports campaign
  templates, required QR code, 3x2 default tags, optional 2x2 tags, image/text
  placement, merge fields, batch printing, requested tag counts, blank/manual
  tags, cut lines, and PDF output.
- People has Intake, Directory, and Reports flows. Intake supports smoother
  add-family/add-child/add-gifts/add-next-recipient paths, organization type
  management, and families under organizations. Directory tables support
  PDF/CSV export, sortable person IDs, sortable organization program codes,
  program-abbreviation quick filters, inline gift/sponsor summaries, and
  gift-detail exports with child/gift/sponsor/received/picked-up columns.
- Sponsors has Intake, Directory, Reports, and drawer-based communication
  workflows. Sponsor drawers prioritize interaction/last-contact context and
  support sending campaign communication templates to the sponsor.
- Gifts has Gift Search, Gift Status visual report, Gift Operations, Gift Pool,
  scan actions, and tag printing. Gift Status supports program-abbreviation
  quick filters and visible-tab polling so QR scan updates appear without
  manual refresh.
- Reports and Admin Activity Log have PDF and true Excel (`.xlsx`) exports.
- Admin includes User Management, Activity Log, Ask Review, Campaign
  Operations, Organization Types, LLM Configuration, Health Check, and App
  Capabilities.
- Profile/user settings screens exist and allow profile/password management,
  including the requested password visibility affordance.
- The downloadable user guide PDF in `blessing-tree-ui/public/` is generated
  from `docs/user-guide/` and includes refreshed screenshots, Activity Log, and
  report export documentation.

## Deployment Reality

- Docker setup exists for running the app on EC2 with Caddy as the reverse
  proxy and RDS/MySQL as the production database.
- GitHub Actions deployment workflow builds/pushes images and deploys to the
  EC2 host using repository secrets.
- Caddy handles SSL automatically when DNS points at the EC2 instance.
- Production SMTP is expected to be configured through environment variables
  such as SMTP host, port, username, password, from email, and TLS/SSL flags.
- Qdrant variables are needed when semantic Ask/knowledge retrieval or semantic
  gift search is enabled.
- Local `blessing_tree` can be reset and seeded with `Blessing Tree Demo 2026`
  using `blessing-tree-api/scripts/seed_demo_campaign_2026.py --reset --yes`.
  The seed preserves users/auth/config, creates 5 demo users, 4 organizations,
  100 Blessing Tree families, 250 children, 40 nursing-home adults, 92 sponsors,
  809 wishlist items, and 81 committed gifts with no received/wrapped/ready
  states.

## Runtime Notes

- User controls local backend/frontend/Celery/Celery Beat processes. Do not
  start or stop long-running app processes unless the user explicitly asks.
- Celery startup commands belong in `README.md`; keep them current when worker
  or queue names change.
- Feature work must happen on a feature branch. Do not commit directly to
  `main`.
- Migrations are expected to be run and verified locally and remotely when the
  user asks for deployment/migration work.

## Verification Recently Run

For the latest report/export/user-guide branch:

- `npm run lint` passed.
- `npm run build` passed with the known Vite large-bundle warning.
- `PYTHONPATH=blessing-tree-api blessing-tree-api/.venv/bin/python -m pytest blessing-tree-api/tests/features/campaigns/test_ask_api.py -q` passed.
- `git diff --check` passed.
- User-guide PDF/DOCX structural checks confirmed the Activity Log and export
  documentation are present.
