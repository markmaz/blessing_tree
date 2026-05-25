# Deep Code Review Remediation Plan

Date: 2026-05-23

Scope: sponsor workspace, public sponsor signup/verification, admin milestone definitions, and dynamic readiness rules.

## Priority Fixes

### P1: Sponsor deletion leaves gift inventory unavailable

Status: implemented.

When a campaign sponsor is deleted, the sponsorship and sponsorship item rows are removed, but linked wishlist items stay `COMMITTED`. Public sponsor inventory and sponsor workspace need counts only include `OPEN` wishlist items, so these gifts disappear from sponsorship inventory.

Implementation:
- Before deleting a sponsorship, collect linked wishlist items.
- Reset each linked item from `COMMITTED` to `OPEN`.
- Keep the reset scoped to items linked through the sponsorship being deleted.
- Add a regression test that deletes a sponsor with sponsored gifts and verifies the gifts return to open inventory.

### P1: Public sponsor verification race returns an unhandled database error

Status: implemented.

Verification re-checks selected gifts before creating sponsorship items, but a concurrent verification can still win between the availability query and commit. The database uniqueness constraint prevents double ownership, but the public endpoint currently commits directly, so the losing request can become a 500 instead of a conflict.

Implementation:
- Catch `IntegrityError` around the verification flush/commit path.
- Roll back and return a 409 `ServiceError` with unavailable selected item details.
- Add a service-level regression that simulates a conflicting `SponsorshipItem` before verification commit.

### P1: Deactivating milestone definitions can strand readiness rules and delete schedule data

Status: implemented.

Admin milestone definitions can be deactivated while active readiness rules still reference them. Studio only validates against active definitions and deletes omitted milestones during replacement, so a deactivated definition can become impossible to satisfy and existing campaign milestone dates can be dropped on the next schedule save.

Implementation:
- Block deactivation of a milestone definition while active readiness rules reference it.
- Keep existing inactive campaign milestones accepted during Studio replacement so saves do not delete existing values just because the definition was later deactivated.
- Add tests for blocking referenced deactivation and preserving inactive existing campaign milestones.

## Follow-up Fixes

### P2: Failed verification email has no staff recovery path

Status: implemented.

Public signup can persist a pending registration even when email delivery fails, but staff cannot resend, cancel, or manually verify it from the pending-registration API.

Recommended implementation:
- Add protected pending-registration actions: resend verification email, cancel registration, and optionally manual verify.
- Surface these actions in the sponsor workspace pending-registration panel.
- Record system interactions for resend/manual verification.

### P2: Public rate limiting trusts `X-Forwarded-For`

Status: implemented.

The public API uses the first `X-Forwarded-For` value as the client IP. This should only be trusted if the deployment proxy strips and rewrites the header.

Recommended implementation:
- Configure Flask/ProxyFix or a trusted proxy setting.
- Fall back to `remote_addr` unless the request comes from a trusted proxy.

### P3: Pending-registration fetch failures are hidden in the UI

Status: implemented.

The sponsor workspace catches pending-registration API failures and displays an empty pending list. Permission/API failures should remain visible to staff.

Recommended implementation:
- Track pending registration load errors separately.
- Show a non-blocking warning in the workspace panel.

### P3: Duplicate readiness findings for the same missing milestone

Status: implemented.

The dynamic readiness evaluator can show both a sponsor blocker and a generic warning for the same missing milestone. This is technically correct but noisy.

Recommended implementation:
- Suppress lower-severity duplicate missing-milestone items for a milestone key when a higher-severity blocking item already exists.
- Keep the behavior deterministic and covered by readiness tests.

## Implementation Order

1. Fix and test the three P1 issues.
2. Add the pending-registration recovery API and UI.
3. Harden public rate limiting.
4. Improve pending-registration error visibility.
5. Deduplicate readiness findings.
