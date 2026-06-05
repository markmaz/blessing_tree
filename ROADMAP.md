# Blessing Tree Roadmap

Last updated: 2026-06-01

This roadmap reflects the current codebase after the Ask Blessing Tree,
calendar intelligence, Activity Log, report export, gift tag builder, sponsor
communications, user access, and deployment work.

## Completed Foundation

- Project structure, dependency manifests, environment examples, and setup docs.
- Flask API, React/Vite UI, MySQL migrations, Celery worker/beat, and Valkey
  queueing.
- Docker/Caddy/EC2 deployment support with GitHub Actions.
- Local/password authentication, password reset, keep-signed-in, profile/user
  settings, and admin-managed user lifecycle.
- Campaign-scoped access control with user-friendly Admin User Management.
- Admin Health, LLM Configuration, App Capabilities, Organization Types,
  Campaign Operations, Ask Review, and Activity Log.

## Completed Product Areas

- Campaign Library and Campaign Studio.
- Campaign settings, readiness, milestones, gift policies, calendar/schedule,
  team/roster, communications, flyer builder, and gift tag builder.
- People Intake, People Directory, organization types, families under
  organizations, recipients, contacts, wishlists, and People Reports.
- Sponsor Intake, Sponsor Directory, Sponsor Reports, public sponsor
  registration/verification, sponsor interaction logs, and sponsor-specific
  communication sends.
- Gift Search, Gift Status visual report, gift operations, gift pool, QR scan
  actions, reminder rules, tag printing, manual tags, and public/mobile pickup
  actions.
- Ask Blessing Tree help, navigation, field help, report questions, calendar
  questions, prompt logging/review, optional LLM NER, and optional Qdrant
  retrieval.
- Report exports to PDF and true `.xlsx`, including Admin Activity Log export.
- Detailed generated user guide with refreshed screenshots and downloadable PDF.

## Current Near-Term Focus

1. Merge and deploy the report export/user-guide branch.
2. Production smoke-test:
   - report PDF export
   - report Excel export
   - Activity Log PDF/Excel export
   - downloadable user guide PDF
3. Watch Ask Blessing Tree prompt logs and promote repeated misses into the
   field/help/report catalogs.
4. Validate Activity Log coverage with real user workflows and add event writers
   for any new mutating workflow.
5. Continue production hardening around logs, CloudWatch, health visibility,
   and bundle-size/performance cleanup.

## Likely Next Product Enhancements

- Server-side large-report export if users need "all matching rows" instead of
  currently loaded rows.
- More polished operational monitoring/log review beyond Admin Health.
- More Ask Blessing Tree report prompts from real staff usage.
- Better campaign asset/theme management if users need controlled flyer/gift
  tag image libraries.
- Import tools only after production users confirm the expected spreadsheet
  shapes.
- Additional report screens as real operational questions emerge.
