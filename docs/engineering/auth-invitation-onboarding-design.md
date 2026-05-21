# Invitation-Centric Authentication Design

## Purpose

Define the onboarding and authentication model for Blessing Tree so that:

- admin invitation is the only entry funnel into the app
- invited users choose their preferred authentication method
- app access remains admin-controlled
- invitation lifecycle stays accurate regardless of auth method
- OAuth does not silently become open self-signup

## Current Problem

The current implementation is split across two mental models:

- admin invitation exists and currently completes only through local password setup
- Google and Yahoo OAuth can log a person in if an `AppUser` already exists for that email

That means:

- invitation acceptance is local-password-specific
- OAuth onboarding is partially supported, but it does not close the invitation loop
- an invited user could authenticate through Google/Yahoo and still leave the invitation marked `pending`

This is functionally workable, but inconsistent for users and hard to reason about operationally.

## Decision

Blessing Tree should use **invitation-centric onboarding**.

The rules are:

- invitation is the only onboarding funnel
- open self-signup is not allowed
- invited users may complete onboarding with:
  - local password
  - Google
  - Yahoo
- the first successful identity binding accepts the invitation
- app roles remain internally assigned and controlled by admins
- later sign-ins use whatever identities the user has already linked

## Core Model

There are 3 separate concerns:

1. Account provisioning
2. Identity binding
3. Authorization

They should stay distinct.

### 1. Account Provisioning

Account provisioning is admin-controlled.

The admin creates a user and invitation record.

This means:

- the person is allowed into the app
- the app knows their global app role
- the app can later attach one or more auth identities to that user

Provisioning does **not** imply a particular auth method.

### 2. Identity Binding

Identity binding is user-chosen during onboarding.

Allowed first-time auth methods:

- `LOCAL`
- `GOOGLE`
- `YAHOO`

The invited user selects how they want to authenticate.

The first successful binding:

- links that identity to the pre-provisioned user
- marks the invitation accepted
- creates a session

### 3. Authorization

Authorization remains internal and admin-controlled.

Auth method must not determine role or access.

That means:

- no role inference from Google/Yahoo
- no “anyone with the email domain gets in”
- no self-created users through OAuth

## Desired User Experience

### Admin Flow

1. Admin creates user from Admin → User Management
2. System creates:
   - `AppUser`
   - invitation record
3. User receives invite link

### Invitee Flow

1. User opens invite link
2. Invite page validates token
3. Invite page presents auth choices:
   - Continue with Google
   - Continue with Yahoo
   - Set password
4. User completes one of those
5. System binds identity, accepts invitation, and signs the user in

### Returning User Flow

Once onboarding is complete:

- Google/Yahoo login behaves like normal sign-in for linked users
- local login behaves like normal sign-in for linked local identities
- no invitation token is required anymore

## Required Behavioral Rules

### Rule 1: Invite Token Required For First-Time Onboarding

If a user is onboarding for the first time, the flow must start from a valid invite token.

The invite token is what authorizes first-time identity binding.

Without a valid invite token:

- Google/Yahoo must not create a new user
- Google/Yahoo must not bind a new identity to an invited-but-unverified person
- local password creation must not proceed

### Rule 2: OAuth For Existing Linked Users Still Works

If a Google or Yahoo identity is already linked to a user:

- direct provider sign-in should continue to work from `/login`

This is normal returning-user behavior and should not require an invite token.

### Rule 3: Pre-Provisioned But Not Yet Linked Users Must Finish Through Invite Flow

If an `AppUser` exists but the user has not yet completed onboarding:

- direct provider login from `/login` should not silently finish onboarding
- instead, the user should be directed to use the invite link

This keeps onboarding explicit and preserves invitation state.

### Rule 4: First Successful Identity Binding Accepts The Invite

The invitation should be marked accepted when:

- local identity creation succeeds, or
- Google identity binding succeeds, or
- Yahoo identity binding succeeds

Invitation acceptance is not tied specifically to password setup.

### Rule 5: Identities May Be Added Later

After onboarding, the system may eventually support linking additional auth identities.

Examples:

- start with Google, later add local password
- start with local password, later add Yahoo

That is a future account-settings concern, not part of first-pass onboarding.

## Backend Design

### Existing Data Model

Current relevant backend models:

- `AppUser`
- `AuthIdentity`
- `AdminUserInvitation`

This design should reuse those rather than inventing a new user model.

### Invitation Lifecycle States

Current invitation lifecycle should remain conceptually:

- `pending`
- `accepted`
- `revoked`
- `expired`

But `accepted` must no longer mean “password was set.”

It must mean:

- at least one valid auth identity has been successfully bound

### AuthIdentity Semantics

`AuthIdentity` is the durable auth-method binding table.

Provider values:

- `LOCAL`
- `GOOGLE`
- `YAHOO`

The onboarding flow should create exactly one identity on first successful completion.

### New Backend Flow Requirements

#### 1. Invite Validation Endpoint

Keep the existing invite validation endpoint, but the payload should explicitly drive auth choice UI.

Current shape is broadly acceptable.

Recommended additions:

- whether local identity already exists
- whether any non-local identity already exists
- whether onboarding is already complete

#### 2. Invite-Scoped OAuth Start

Add invite-scoped OAuth start routes or parameters.

Recommended shape:

- `GET /api/v1/auth/invite/google/login?token=...`
- `GET /api/v1/auth/invite/yahoo/login?token=...`

Alternative acceptable shape:

- reuse existing provider login routes with an invite token parameter and explicit onboarding mode

The important rule is:

- the backend must know this OAuth round-trip is invite-scoped onboarding, not ordinary login

#### 3. Invite-Scoped OAuth Callback

On callback:

1. validate invite token or previously stored invite state
2. fetch provider userinfo
3. verify email matches the invited account
4. bind identity to the invited `AppUser`
5. mark invitation accepted
6. issue refresh cookie and complete sign-in

If the provider email does not match the invited email:

- reject the onboarding attempt
- do not bind the identity
- do not accept the invitation

#### 4. Direct OAuth Login Should Not Finish Unaccepted Invites

Current behavior allows a pre-provisioned email to complete provider login from the generic `/login` buttons.

That should change.

Recommended generic login behavior:

- if provider identity already exists: log in
- if provider identity does not exist:
  - do not auto-link for invite-only onboarding
  - return a clear “Use your invitation link to finish setup” error

This keeps `/login` for returning users and the invite link for first-time users.

#### 5. Local Invite Acceptance Remains Valid

Local password onboarding should continue to exist.

It becomes one auth option among several, not the definition of invite acceptance.

## Frontend Design

### Entry Screen

`/auth/register?token=...` becomes the onboarding choice page.

It should:

- validate the invitation token
- show invited email and display name
- explain that the invite is how app access is activated
- present auth choices

Primary actions:

- Continue with Google
- Continue with Yahoo
- Set password

### UI Copy Direction

The page should communicate:

- “You’ve been invited to Blessing Tree”
- “Choose how you want to sign in”
- “You can use Google, Yahoo, or a local password”

This is clearer than presenting it as only a password-registration page.

### OAuth Completion UX

After invite-scoped OAuth callback:

- if successful, route into normal authenticated app entry
- if failed, return to invite page with a specific error

Examples:

- email does not match invitation
- invitation expired
- invitation already accepted
- provider authentication failed

## Security Rules

- invitation token must remain signed and time-limited
- provider email must match the invited email before first-time binding
- backend remains authoritative for whether onboarding is allowed
- frontend gating is UX only
- app role assignment stays internal to admin workflows
- OAuth must never auto-create unrestricted users

## Recommended API Contract Changes

### Keep

- `GET /api/v1/auth/invite/validate/<token>`
- `POST /api/v1/auth/invite/accept`

### Add

- invite-scoped provider login endpoints or equivalent onboarding parameters
- callback completion logic that accepts invitation on successful OAuth binding

### Change

- generic Google/Yahoo login should no longer auto-complete onboarding for merely pre-provisioned emails

## Edge Cases

### Invited user chooses Google but later wants local password

Not part of onboarding.

This should become a future “link/add auth method” feature under account settings.

### Invited user signs in with wrong Google/Yahoo email

Reject.

Do not bind.
Do not accept the invitation.

### Invite already accepted, but user revisits invite link

Show a clear message:

- onboarding already complete
- proceed to sign in

### Admin re-sends invite after partial attempt

The newest pending invite token should be authoritative.

Older revoked links should remain invalid.

## Migration Impact

No schema redesign is strictly required for v1 of this change.

This is mostly:

- route behavior
- invitation lifecycle handling
- OAuth flow handling
- frontend onboarding UI

Possible future schema enhancement:

- explicit onboarding completion timestamp on `AppUser`

Not required for the first implementation.

## Implementation Phases

### Phase 1: Lock Direct OAuth Login To Returning Users

- change generic Google/Yahoo login so it only succeeds for already-linked provider identities
- stop auto-linking pre-provisioned users from `/login`
- return a clear onboarding-required error

### Phase 2: Make Invite Page Multi-Method

- redesign `/auth/register` to offer:
  - Google
  - Yahoo
  - local password

### Phase 3: Add Invite-Scoped OAuth Flow

- add backend invite-scoped provider start/callback handling
- bind provider identity to invited user
- mark invite accepted on success

### Phase 4: Polish Errors And Completion State

- better user-facing onboarding errors
- already-accepted invite handling
- smoother callback completion messaging

## Testing Requirements

Backend tests:

- invited user can accept via local password
- invited user can accept via Google
- invited user can accept via Yahoo
- provider email mismatch is rejected
- expired/revoked invite is rejected
- generic OAuth login works for already-linked identities
- generic OAuth login does not onboard merely pre-provisioned users

Frontend tests:

- invite page renders all auth choices
- local password path still works
- invite-scoped OAuth start links include the required state/token
- invite completion errors render correctly
- already-accepted invite messaging is clear

## Recommended Final Product Rule

Blessing Tree should follow this rule:

> Invitation grants the right to onboard. Authentication method is chosen by the invited user. Authorization remains controlled by admins.

That is the clean model for this app.
