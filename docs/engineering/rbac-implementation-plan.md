# RBAC Implementation Plan

## Objective

Implement Blessing Tree RBAC in a way that supports:

- app-wide administration
- campaign-scoped operational roles
- feature-level access restrictions

This plan follows the design in
`docs/engineering/rbac-design.md`.

## Phase 1: Foundation

### Goal

Create the minimum backend model and policy layer without wiring every screen.

### Tasks

1. Add campaign role persistence
   - create DB migration for `campaign_user_role`
   - add SQLAlchemy model
   - add indexes and uniqueness constraints

2. Normalize app-level role handling
   - decide short-term compatibility behavior for current `app_user.role`
   - map existing values to app-level semantics

3. Add capability constants and role bundles in code
   - create central capability list
   - create central campaign-role-to-capability map

4. Add backend authorization service
   - app admin check
   - campaign role lookup
   - effective capability resolution
   - capability check helpers

### Deliverables

- migration file
- model file
- authorization service
- initial role/capability matrix

## Phase 2: Enforcement Infrastructure

### Goal

Make RBAC easy to apply consistently to APIs.

### Tasks

1. Add route guard/decorator helpers
   - `require_app_admin`
   - `require_campaign_capability(...)`

2. Standardize campaign scope extraction
   - prefer campaign IDs in route paths
   - avoid hidden scope from ambiguous request payloads

3. Add basic authz error format
   - `403 forbidden`
   - clear machine-readable error code
   - user-safe message

### Deliverables

- reusable decorators/helpers
- documented authorization failure behavior

## Phase 3: Bootstrap and Frontend Contract

### Goal

Expose enough authorization state for frontend gating.

### Tasks

1. Add backend payload shape for current user authz context
   - global role
   - campaign roles for selected campaign or current scope
   - effective capabilities

2. Add frontend capability model
   - capability types/constants
   - helper like `hasCapability(capability)`

3. Add frontend gating primitives
   - route guard hooks/components
   - nav visibility helpers
   - action/button guards

### Deliverables

- backend authz context contract
- frontend capability helpers
- basic UI gating primitives

## Phase 4: Apply RBAC to First Domain Slice

### Goal

Use RBAC in real business APIs instead of only scaffolding it.

### Recommended first protected areas

1. Campaign read/admin endpoints
2. Recipient group and recipient APIs
3. Donation entry APIs
4. Gift check-in APIs

### Example enforcement targets

- donation entry screens require `campaign.donations.edit`
- gift check-in screens require `campaign.gifts.check_in`
- recipient editing requires `campaign.recipients.edit`
- manager-only campaign settings require `campaign.admin`

### Deliverables

- first real protected endpoints
- first real protected frontend screens

## Phase 5: Admin Workflows

### Goal

Make role assignment operationally usable.

### Tasks

1. Add backend assignment endpoints
   - list campaign role assignments
   - assign role
   - revoke role

2. Add admin UI
   - assign users to campaign roles
   - inspect effective access by campaign

3. Add validation rules
   - only app admins can manage assignments in v1
   - reject unknown roles
   - reject duplicate active assignments

### Deliverables

- admin role-assignment API
- admin role-assignment UI

## Testing Plan

### Backend

- role resolution unit tests
- capability resolution unit tests
- decorator/guard tests
- endpoint authorization tests

### Frontend

- capability helper tests
- route guard tests
- nav/action visibility tests

## Suggested File Ownership

### Backend

- `blessing-tree-api/app/models/`
  - `campaign_user_role.py`
- `blessing-tree-api/app/services/`
  - `authorization_service.py` or `rbac_service.py`
- `blessing-tree-api/app/decorators/`
  - authorization decorators/helpers
- `blessing-tree-api/db/migration/`
  - RBAC migration

### Frontend

- `blessing-tree-ui/src/shared/authz/`
  - capability constants
  - helper functions
  - guard utilities

## Proposed Delivery Order

1. backend migration + model
2. backend capability matrix + service
3. backend decorators
4. frontend authz model
5. apply to first real campaign APIs
6. admin assignment workflows

## Key Decisions Locked By This Plan

- campaign is the primary authorization boundary
- multiple campaign role assignments are allowed
- capabilities are checked explicitly
- role definitions live in code in v1
- fully dynamic RBAC is deferred
