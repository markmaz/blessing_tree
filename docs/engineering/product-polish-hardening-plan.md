# Product Polish And Hardening Plan

## Purpose

Blessing Tree has the core campaign workflows in place: recipient intake, sponsor intake, gift commitments, QR drop-off receiving, mobile operator mode, reports, exports, communications, and admin health tooling. The next workstream should move the product from "works for us" toward "safe for a paying organization to use without direct developer assistance."

This plan covers polish areas 3-7 from the commercial readiness discussion, with the UI consistency pass intentionally first because it gives the reliability and permission work a cleaner base.

## Guiding Principles

- Keep the product focused on gift sponsorship campaign operations, not generic nonprofit CRM.
- Favor predictable workflows over clever UI.
- Make every screen answer: what is this, what state is it in, what can I do next?
- Make failure states understandable to non-technical users.
- Preserve Blessing Tree branding while tightening layout, spacing, and controls.
- Avoid large rewrites unless a shared pattern clearly reduces repeated complexity.

## Phase 1: UI Consistency Pass

### Goal

Make People, Sponsors, Gifts, Campaign Studio, Mobile, and Admin screens feel like one coherent application.

### Scope

- Standardize page headers, subtitles, metadata, and primary action placement.
- Standardize container spacing, section spacing, and bottom padding around controls.
- Standardize directory controls:
  - search on the left or full-width when appropriate
  - quick filters below/near search
  - expand all/collapse all on the left for accordion-style directories
  - PDF/Excel/export actions in the upper-right of the containing panel
- Standardize table behavior:
  - consistent sortable header indicators
  - consistent row density
  - consistent status badges
  - predictable action column placement
  - empty states that explain the next action
- Standardize drawers:
  - consistent title/subtitle/action header
  - consistent accordion section headers
  - consistent save/delete/secondary button placement
  - tighter form spacing
  - visible selected-object states for sponsor/gift selection patterns
- Standardize confirmation modals:
  - destructive action copy
  - button order
  - sponsor/gift/campaign details shown in the body
  - strong confirmation only for high-risk destructive actions
- Standardize mobile screens:
  - retain Blessing Tree styling
  - larger touch targets
  - consistent scan/search/receive feedback
  - no desktop-only controls leaking into mobile

### Screen Order

1. People directory and reports.
2. Sponsor directory, intake, and sponsor drawer.
3. Gift search, gift operations, receive flows, and gift reports.
4. Campaign Studio and communications screens.
5. Mobile shell, mobile search, scan, and receiving screens.
6. Admin screens and health checks.

### Deliverables

- Shared UI inventory of repeated patterns and one-off exceptions.
- CSS/component cleanup where duplication is causing inconsistency.
- Screen-by-screen adjustments with no major behavior changes unless a behavior is clearly confusing.
- Screenshots or browser checks for representative desktop and mobile viewports.

### Acceptance Criteria

- Export actions appear in the same relative location across directories and report panels.
- Expand/collapse controls appear in the same relative location across accordion directories.
- Drawer sections use the same spacing, header style, and action placement.
- Tables use consistent status badges and sortable header affordances.
- Mobile screens have no overlapping controls and no desktop-only layout assumptions.

## Phase 2: Email And QR Reliability Diagnostics

### Goal

Make sponsor communications and QR drop-off workflows trustworthy and debuggable.

### Scope

- Email send status:
  - sent, failed, pending, partial
  - recipient counts
  - timestamp and sender
  - failure reason when available
- Template validation:
  - missing merge fields
  - sponsor has no email
  - sponsor has no committed gifts
  - QR fields used without valid sponsor context
  - map/location fields missing
- Test email diagnostics:
  - show SMTP/config failures clearly
  - distinguish template rendering errors from mail transport errors
  - show which merge fields were used
- QR diagnostics:
  - active token count
  - generated drop-off URL
  - QR image URL
  - last scanned
  - scan count
  - expired/revoked state
  - campaign id carried in link
- Operational recovery:
  - resend where safe
  - regenerate/revoke QR token
  - clear explanation for old links, wrong campaign, expired links, and revoked links

### Deliverables

- Communication send history improvements.
- Sponsor drawer QR diagnostics improvements.
- Better user-facing errors for email and QR failures.
- Regression tests for QR campaign context, expired tokens, revoked tokens, and missing sponsor email.

### Acceptance Criteria

- A staff user can tell whether a sponsor email actually sent.
- A staff user can inspect a sponsor drawer and know whether the QR token is active and when it was last scanned.
- A failed test email explains whether the problem is template data, SMTP config, or transport failure.
- QR scan failures show specific states instead of generic "not found" wherever possible.

## Phase 3: Permission Cleanup

### Goal

Make role behavior clear, enforceable, and safe for real campaign teams.

### Proposed Role Matrix

| Role | Primary Capabilities |
| --- | --- |
| System Admin | users, system settings, health checks, all campaigns |
| Campaign Manager | campaign setup, teams, recipients, sponsors, gifts, communications, reports |
| People Intake | recipient groups, recipients, wishlists, people directory |
| Sponsor Intake | sponsors, sponsor commitments, sponsor communications, sponsor directory |
| Gift Operations | gift search, commit/release where allowed, receive/unreceive, QR scanning |
| Read Only | directories, reports, no edits |

### Scope

- Review current RBAC capabilities and map them to the proposed roles.
- Hide actions the user cannot perform instead of showing buttons that fail.
- Lock campaign delete/settings to admin-level permissions.
- Lock mobile receive and QR drop-off to gift operation permissions.
- Lock communication send to campaign manager or sponsor intake permissions.
- Ensure exports are allowed for appropriate read/report roles.

### Deliverables

- Updated role/capability matrix document.
- UI action visibility cleanup.
- API tests for major permission boundaries.

### Acceptance Criteria

- Each major action has a documented capability.
- Users without a capability do not see primary action buttons for that action.
- APIs reject unauthorized actions even if the UI is bypassed.
- Mobile operator routes are constrained to the smallest useful permission set.

## Phase 4: Mobile Receiving Hardening

### Goal

Make event-day gift receiving reliable under stress, poor lighting, and accidental taps.

### Scope

- Improve bad-scan states:
  - unsupported QR
  - expired QR
  - revoked QR
  - valid token with no committed gifts
  - wrong or missing campaign context
- Improve receive/unreceive feedback:
  - strong success state
  - immediate undo for accidental receive
  - clear already-received state
  - recently received list
- Improve touch usability:
  - larger buttons
  - better spacing between receive and undo
  - loading state per gift
  - avoid double-submit
- Keep scanner path open:
  - preserve manual recipient ID entry
  - preserve QR URL parsing
  - allow future camera/scanner input without route changes

### Deliverables

- Hardened mobile receive and sponsor drop-off pages.
- Mobile scanner error-state coverage.
- Browser checks at phone viewport sizes.

### Acceptance Criteria

- A worker can scan or enter a recipient ID, receive a gift, and correct an accidental receive without switching to desktop.
- Repeated taps do not duplicate operations.
- Bad QR codes produce useful messages.
- The mobile UI remains readable and usable on common phone widths.

## Phase 5: Backups, Restore, And Safety

### Goal

Reduce production risk before more organizations use the system.

### Scope

- Document backup and restore procedures for the production stack.
- Add or document scheduled database backups.
- Add production-safe campaign delete protections:
  - admin-only
  - strong typed confirmation
  - clear list of what will be deleted
  - no accidental seed overwrite
- Add environment safety checks:
  - local/demo seed scripts cannot target production by accident
  - production seed script only creates a new campaign unless explicitly told otherwise
- Expand admin health checks:
  - DB
  - Valkey
  - Celery/worker
  - Qdrant
  - embedding provider
  - email provider
  - storage/disk

### Deliverables

- Production backup/restore runbook.
- Safer destructive actions.
- Seed script guardrails.
- Expanded health check documentation and tests where practical.

### Acceptance Criteria

- There is a documented way to restore production from backup.
- Campaign delete cannot happen without a high-confidence admin confirmation.
- Demo seed scripts cannot silently wipe production data.
- Admin health clearly identifies which dependency is failing.

## Suggested Implementation Sequence

1. Create shared UI inventory and fix the highest-traffic UI inconsistencies first.
2. Complete sponsor drawer, gift search, and mobile receiving consistency because those are the live campaign workflows.
3. Add email/QR diagnostics now that the sponsor QR workflow is real.
4. Tighten permissions after the UI action inventory is known.
5. Harden mobile receiving based on user review feedback.
6. Finish backup/restore and production safety runbooks before onboarding outside organizations.

## Initial Branching Plan

- Base new work from `origin/main`.
- Use one branch per phase unless the phase is very small.
- Suggested first implementation branch: `codex/ui-consistency-pass`.
- Keep this document updated as decisions change.

## Open Questions

- Should the UI consistency pass introduce shared components, or should it first normalize existing CSS and markup?
- Should communication diagnostics live inside Campaign Studio, Sponsor drawer, or both?
- Should mobile gift receiving require a dedicated `Gift Operations` role, or can Sponsor Intake receive gifts too?
- How much of backup/restore should be automated before the first external pilot?
