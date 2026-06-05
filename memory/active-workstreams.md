# Active Workstreams

Last updated: 2026-06-05

## Current Phase

The current feature branch is `codex/sponsor-dropoff-qr-workflow`.

The current active work is finishing Mobile Operator Mode after completing the
report/export, production deployment, semantic search, demo seeding, and
operational hardening branch.

The follow-on branch `codex/sponsor-dropoff-qr-workflow` has implemented the
sponsor drop-off QR workflow through the in-app scanner phase:

- added hashed sponsor drop-off tokens and migration `V046`
- added authenticated mobile drop-off payload API
- added `/mobile/receive/dropoff/:token`
- added sponsor email merge fields for drop-off URL, QR image, recipient IDs,
  and recipient/gift summary
- updated the demo drop-off reminder template to include the QR image and URL
  fallback
- added focused backend tests for sponsor QR merge fields and payload resolve
- added `/mobile/scan` with a lazy-loaded browser QR decoder
- added a Scan action to mobile Receive
- scanner routing supports sponsor drop-off QR URLs, existing gift label scan
  URLs, and typed recipient IDs
- added focused mobile scanner parser tests

Recently completed mobile work:

- `/mobile` lightweight protected shell with Blessing Tree styling.
- phone-only redirect guard with full-site escape hatch.
- mobile Receive by recipient ID, including immediate un-receive for gifts still
  at `RECEIVED`.
- mobile Gift Search cards with recipient/group/sponsor details plus commit,
  release, receive, and undo actions.
- mobile Sponsor Search cards with committed gift summaries.
- mobile Group Search cards with recipient, wishlist, sponsor, and status
  summaries.
- public gift QR scan now shares the mobile scan view/styling while remaining
  outside the authenticated `/mobile` shell.

Recently completed broader platform work:

- Reports export real PDFs and true Excel `.xlsx` workbooks.
- Gift Search has improved query semantics and optional Qdrant-backed semantic
  retrieval for broad/synonym-style searches such as "toys for boys under 8".
- Admin Health checks Qdrant and can generate vector indexes.
- Recipient/wishlist-item mutations enqueue async Valkey/Celery gift reindex
  work.
- Production Docker Compose includes Qdrant and Valkey; Qdrant is internal-only
  on the compose network and uses `restart: unless-stopped`.
- The EC2 production server now runs a self-hosted GitHub Actions runner named
  `prod-blessing-tree-ip-172-31-30-142` with label `prod-blessing-tree`.
- GitHub Actions deploy workflows now build on GitHub-hosted runners, then run
  the EC2 deploy step on `[self-hosted, prod-blessing-tree]` without SSH/scp.
- `/opt/blessing-tree/shared/blessing-tree.env` was cleaned so production uses
  a single Qdrant block with `QDRANT_URL=http://qdrant:6333`.
- The demo campaign seed script now supports safe append-only production seeding
  with `--append --campaign-name ... --campaign-slug ...`.
- Production was seeded with a new active campaign named
  `Blessing Tree Walkthrough Demo 2026` without replacing the existing
  `Blessing Tree 2026 Demo`.

Recent commits pushed to `codex/report-exports`:

- `d30cd61 Add campaign reports and semantic gift search`
- `f71423a Use self-hosted runner for EC2 deploy`
- `0f52875 Preserve shared env ownership during Docker deploy`
- `a81ceec Allow appending demo campaign seed`

## Recently Completed Since The Older May Memory

- Built and deployed Docker/Caddy/EC2/RDS-oriented production setup.
- Added GitHub Actions deployment support.
- Configured production SMTP/SES/Zoho-oriented email settings during deployment
  work.
- Removed normal sign-in Google/Yahoo buttons after deciding they would confuse
  users.
- Added delete-user support for deactivated users.
- Implemented Ask Blessing Tree MVP and subsequent iterations:
  - top-level navigation
  - conversational UI
  - reduced curated prompts
  - clear-chat action
  - thumbs up/down feedback with selected-state color
  - prompt logging/review
  - optional LLM NER
  - optional Qdrant-backed knowledge retrieval
  - field-level help dialog integration
  - knowledge-base/user-guide integration
  - report/query prompts
  - calendar intelligence prompts
- Added campaign calendar intelligence:
  - shared backend read model
  - Campaign Studio Schedule integration
  - Dashboard upcoming calendar widget
  - Ask Blessing Tree date/timing answers
  - documentation updates
- Reworked Campaign Studio AI panel so it behaves like Ask Blessing Tree and
  uses Blessing Tree styling and the dialogue-bubble icon.
- Added operational logging:
  - local file logging configuration
  - deployment/env documentation for log settings
  - Admin Health remains available for runtime checks
- Added Admin Activity Log:
  - durable audit table
  - API/list/detail
  - Admin UI filters/pagination/drawer
  - broad workflow event writers
  - export buttons
  - user-guide documentation
- Added report export infrastructure:
  - shared frontend report export helpers
  - real PDF output
  - true `.xlsx` output
  - report export actions wired to report screens and Activity Log
- Added and iterated the Campaign Flyer Builder.
- Added and iterated the Gift Tag Builder:
  - default seeded template
  - 3x2 default size
  - optional 2x2 size
  - required QR code
  - image/text placement controls
  - batch print quantity
  - blank/manual tags
  - PDF sheet output
- Added password-management changes:
  - 8-character minimum
  - profile password change
  - password visibility affordance
  - forgot-password/reset flow
  - keep-signed-in support
- Expanded sponsor communications:
  - send campaign templates from sponsor drawer
  - gift merge fields/lists
  - direct sponsor send history
  - first-class communication recipient concepts
  - schedule/send-now support
- Improved People/Intake:
  - clearer create button labels
  - generated child names
  - add gifts after adding child/adult
  - add another child/adult flow
  - organization type admin screen
  - family under organization support
  - organization type served category including families
  - updated seeded organization types
- Improved Admin User Management:
  - screen-level access toggle grid
  - campaign access accordions
  - active campaign badges
  - single drawer save action
  - row-click drawer behavior
- Updated Ask Blessing Tree knowledge for:
  - organization types
  - family-in-organization behavior
  - communication sending/scheduling
  - gift tag builder
  - flyer builder
  - Activity Log
  - report exports
  - calendar intelligence
- Added Qdrant-backed semantic gift search:
  - gift search parser improvements for age phrases such as `8 and under`
  - semantic candidate retrieval with SQL/campaign authorization remaining
    authoritative
  - async Valkey/Celery reindex on recipient/gift changes
  - Admin Health Qdrant status and index-generation controls
- Added Docker production Qdrant service and hardened production env:
  - `QDRANT_URL=http://qdrant:6333` inside containers
  - Qdrant internal-only rather than host-published on port `6333`
  - `restart: unless-stopped` for self-healing container restarts
- Added self-hosted GitHub Actions deployment on the Blessing Tree EC2 host:
  - dedicated `github-runner` user
  - runner service active under systemd
  - Docker access and limited passwordless sudo for deploy operations
  - deploy workflows split into GitHub-hosted build and EC2-local deploy
- Added production-safe seed append flow and created production walkthrough
  campaign:
  - `Blessing Tree Walkthrough Demo 2026`
  - slug `blessing-tree-walkthrough-demo-2026`
  - 104 groups, 319 recipients, 319 wishlists, 896 items, 92 sponsorships,
    90 commitments

## Immediate Next Steps

1. Complete and push `codex/mobile-operator-mode`, then merge after review.
2. Merge `codex/report-exports` if it has not already been merged so `main`
   gets the self-hosted runner workflow changes and seed append support.
3. Smoke-test production after the self-hosted deploy:
   - one report PDF export
   - one report Excel export
   - one Activity Log export
   - Gift Search semantic queries after generating the gift index
4. Use Admin Health to generate Qdrant indexes for the production walkthrough
   campaign after seeding/deploying.
5. Reuse this deployment pattern for QueryForge later:
   - app-local self-hosted runner on the production EC2 host
   - build on GitHub-hosted runners
   - deploy/migrate on the self-hosted runner inside AWS
   - Qdrant/Valkey internal compose services with app containers using service
     DNS names instead of localhost
6. Continue product hardening after exports:
   - operational monitoring/log review path
   - bundle-size/performance cleanup
   - more report coverage as users discover needs
   - Ask Blessing Tree prompt tuning from real usage

## Blockers Or Ambiguities

- No current blocker is known for the report/export/deploy branch.
- User controls local app/Celery processes; avoid starting/stopping them unless
  explicitly asked.
- Qdrant should default enabled only when its environment variables and service
  are available; deterministic Ask behavior must continue without it.
- The production self-hosted runner is powerful because it can run commands on
  the EC2 host. Keep it repo-scoped, label-scoped, and protected by the
  GitHub `production` environment approval flow.
