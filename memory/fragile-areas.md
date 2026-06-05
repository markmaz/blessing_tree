# Fragile Areas

Last updated: 2026-06-01

## Auth, Passwords, And Cookies

- `blessing-tree-api/app/routes/auth_routes.py`
- `blessing-tree-api/app/services/auth/`
- `blessing-tree-api/app/features/account/`
- `blessing-tree-ui/src/shared/api/authApi.ts`
- `blessing-tree-ui/src/features/auth/model/authContext.tsx`

These files control login, refresh, forgot password, keep-signed-in, profile
password changes, and sign-out behavior. Frontend and backend can desynchronize
easily.

## App Bootstrap And Runtime Config

- `blessing-tree-api/app/factory.py`
- `blessing-tree-api/app/main.py`
- `blessing-tree-api/app/config/__init__.py`
- `blessing-tree-api/app/celery.py`
- `docker-compose*.yml`
- `.github/workflows/`

These files control startup, env loading, logging, Celery wiring, Valkey,
deployment, Caddy, and production image behavior.

## Migrations And UUID Storage

- `blessing-tree-api/db/migration/`
- `blessing-tree-api/app/models/uuid_bin.py`
- `blessing-tree-api/tests/test_uuid_bin.py`

The app uses binary UUID storage. Migration checks should verify columns,
indexes, foreign keys, and expected seed data after local/remote migration
runs.

## RBAC And Screen Access

- `blessing-tree-api/app/features/rbac/`
- `blessing-tree-api/app/features/admin/user_access_service.py`
- `blessing-tree-ui/src/shared/ui/FeatureGate.tsx`
- `blessing-tree-ui/src/shared/ui/layout/SidebarNav.tsx`
- `blessing-tree-ui/src/app/App.tsx`

The sidebar hides screens based on campaign access, but backend authorization
must remain authoritative. Every new route/screen needs matching capability
checks.

## Ask Blessing Tree

- `blessing-tree-api/app/features/ask/`
- `docs/ask-knowledge-pipeline.md`
- `blessing-tree-ui/src/pages/AskBlessingTreePage.tsx`

Ask combines deterministic routing, report execution, field help, LLM NER,
Qdrant retrieval, prompt logging, and calendar intelligence. Keep arbitrary SQL
or unvalidated tool execution out of this path.

## Reports And Exports

- `blessing-tree-ui/src/features/reports/model/reportExport.ts`
- `blessing-tree-ui/src/features/reports/ui/ReportExportActions.tsx`
- report pages under `blessing-tree-ui/src/pages/`
- `blessing-tree-ui/src/pages/AdminActivityLogPage.tsx`

PDF and Excel export should stay shared and predictable. Any report using
pagination/filtering must be clear about whether it exports visible rows,
loaded rows, or all matching rows.

## Activity Log

- `blessing-tree-api/app/features/admin/audit_service.py`
- `blessing-tree-api/app/models/audit_event.py`
- mutating services across campaigns, people, sponsors, gifts, admin, and Ask

Activity Log coverage is explicit. New mutating workflows need audit events or
they will not appear in Admin > Activity Log.

## Campaign Studio Builders

- `blessing-tree-ui/src/pages/CampaignSponsorFlyerPage.tsx`
- `blessing-tree-ui/src/pages/GiftTagBuilderPage.tsx`
- `blessing-tree-api/app/features/campaigns/flyer_service.py`
- `blessing-tree-api/app/features/gifts/tag_template_service.py`

The flyer and gift-tag builders depend on canvas layout JSON, image handling,
merge fields, PDF output, QR code placement, and print sizing. Small layout
changes should be visually checked.

## Gift Workflow And QR Scan

- `blessing-tree-api/app/features/gifts/`
- `blessing-tree-ui/src/pages/GiftWorkflowReportPage.tsx`
- public scan routes/pages

QR scan actions are used in fast-moving pickup/distribution workflows. Preserve
mobile-friendly behavior and status transition rules.

## User Guide Generation

- `docs/user-guide/build_blessing_tree_user_guide.py`
- `docs/user-guide/build_blessing_tree_user_guide_pdf.py`
- `docs/user-guide/screenshots/`
- `blessing-tree-ui/public/blessing-tree-user-guide.pdf`

When user-facing screens change, regenerate screenshots and both guide formats.
The public PDF must be copied into the UI public folder.
