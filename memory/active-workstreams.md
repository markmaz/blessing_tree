# Active Workstreams

Last updated: 2026-06-01

## Current Phase

The current feature branch is `codex/report-exports`.

The most recent completed work adds true report exports and updates user
documentation:

- Reports now export real PDFs and true Excel `.xlsx` workbooks.
- Admin Activity Log now has PDF and Excel export controls.
- Ask Blessing Tree help/navigation/catalog content now knows about Activity
  Log and report exports.
- The detailed user guide was regenerated as DOCX/PDF.
- The public downloadable user guide PDF was refreshed.
- User-guide screenshots were recaptured from the current local app, including
  a new Admin Activity Log screenshot.

This branch has been committed and pushed:

- commit `53e90ca Add report exports and update user guide`
- branch `codex/report-exports`

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

## Immediate Next Steps

1. Merge/deploy `codex/report-exports` after review.
2. Confirm production deployment picks up the new `xlsx` dependency and user
   guide PDF.
3. Smoke-test one report PDF export, one report Excel export, and one Activity
   Log export in production.
4. Continue product hardening after exports:
   - operational monitoring/log review path
   - bundle-size/performance cleanup
   - more report coverage as users discover needs
   - Ask Blessing Tree prompt tuning from real usage

## Blockers Or Ambiguities

- No current blocker is known for the report export branch.
- User controls local app/Celery processes; avoid starting/stopping them unless
  explicitly asked.
- Qdrant should default enabled only when its environment variables and service
  are available; deterministic Ask behavior must continue without it.
