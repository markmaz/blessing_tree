# Active Workstreams

Last updated: 2026-05-20

## Current Phase

- Active roadmap phase: Phase 2
- Current step: RBAC design documented, implementation pending ahead of the first real API slice

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
- Promoted additional coding rules into engineering policy for file size, single responsibility, version bumps, review, commit discipline, naming, and feature-driven backend structure
- Initialized a single top-level Git repository with root `.gitignore` and `.gitattributes`

## Immediate Next Steps

1. Implement the RBAC schema, role matrix, and backend authorization service
2. Apply RBAC to the first campaign-scoped APIs
3. Start the first real domain API slice on top of the shared authenticated client

## Blockers Or Ambiguities

- There is no RBAC persistence or authorization service in code yet
- Query Forge is a good source for auth/config patterns, but not all of its runtime surface belongs in Blessing Tree
