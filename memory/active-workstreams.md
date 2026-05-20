# Active Workstreams

Last updated: 2026-05-20

## Current Phase

- Active roadmap phase: Phase 3
- Current step: RBAC enforcement infrastructure implemented; first protected APIs are next

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
- Promoted additional coding rules into engineering policy for file size, single responsibility, version bumps, review, commit discipline, naming, and feature-driven backend structure
- Promoted additional delivery rules into engineering policy for migrations, backend-authoritative authz, additive APIs, shared-module scope, tests, and doc updates
- Initialized a single top-level Git repository with root `.gitignore` and `.gitattributes`

## Immediate Next Steps

1. Apply RBAC to the first campaign-scoped APIs
2. Start the first real domain API slice on top of the shared authenticated client
3. Expose capability-aware frontend gating for the first protected screens

## Blockers Or Ambiguities

- RBAC enforcement helpers exist, but no business routes use them yet
- Query Forge is a good source for auth/config patterns, but not all of its runtime surface belongs in Blessing Tree
