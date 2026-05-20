# Blessing Tree Roadmap

This roadmap reflects the current codebase as of 2026-05-19.

## Phase 1: Stabilize the Project Surface

Goal: make the current repo understandable and runnable without tribal knowledge.

- Keep docs accurate and minimal.
- Add a checked-in backend dependency manifest.
- Add an `.env.example` for the backend.
- Verify local startup for both API and UI from clean instructions.

## Phase 2: Align Authentication End to End

Goal: remove the current auth mismatch between backend behavior and frontend UX.

Options:

1. Finish direct auth alignment.
   Keep local login one-step and align OAuth callback completion with the frontend.
2. Implement real second-factor auth later if required.
   Add backend OTP or TOTP generation, delivery, verification, expiry, and failure handling.

Recommended path:

- Keep the simplified one-step local login flow.
- Keep OAuth callback handling and reload-time session restoration aligned with the frontend.
- Keep refresh/logout behavior and cookie handling.
- Route future authenticated UI API calls through the shared refresh-on-401 client.
- Add tests around login, refresh, logout, and callback completion.

## Phase 3: Build the First Real Domain Slice

Goal: move from scaffold to working application behavior.

Before or alongside the first slice, put the lightweight RBAC framework in
place so campaign and feature access are enforced from the first real APIs.

Recommended first slice:

1. Campaigns
2. Recipient groups
3. Recipients
4. Wishlists and wishlist items

Deliverables:

- campaign-scoped RBAC foundation
- backend CRUD/read endpoints
- typed frontend API client
- list/detail/create/edit screens
- validation and error handling
- basic happy-path tests

## Phase 4: Replace Placeholder Pages with Real Data

Goal: make the app shell useful for staff/volunteers.

- Dashboard: show live campaign and workload metrics
- Families: connect to recipient groups and recipients
- Donations: connect to donation and fulfillment data
- Reports: start with operational exports or summaries
- Admin: auth/user/campaign controls

## Phase 5: Operational Hardening

Goal: make the project safer to evolve.

- Add backend test coverage around auth and model behavior
- Add frontend tests for auth and route protection
- Standardize logging, error responses, and environment config
- Add import workflows only when the target data model is settled

## Immediate Next Ticket

If momentum matters, start here:

1. Implement the RBAC foundation from `docs/engineering/rbac-design.md`.
2. Apply it to the first campaign-scoped APIs.
3. Implement campaign/recipient/wishlist read APIs.

That sequence clears the largest current ambiguity and opens the path to real application work.
