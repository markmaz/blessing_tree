# Invitation-Centric Authentication Design

## Purpose

Define the onboarding and authentication model for Blessing Tree so that:

- admin invitation is the only entry funnel into the app
- app access remains admin-controlled
- invitation lifecycle stays accurate
- users have one obvious way to activate their account

## Decision

Blessing Tree uses local credential onboarding only.

Third-party sign-in was intentionally removed because it adds provider setup overhead and creates a confusing choice for non-technical users. Invited users complete onboarding by setting a password from their invitation link.

## Core Model

There are 3 separate concerns:

1. Account provisioning
2. Identity creation
3. Authorization

They should stay distinct.

## Account Provisioning

Account provisioning is admin-controlled.

The admin creates a user and invitation record. This means:

- the person is allowed into the app
- the app knows their global app role
- campaign-specific access can be assigned separately
- the invitation can be tracked until it is accepted

Provisioning does not create a usable sign-in credential by itself.

## Identity Creation

The invitation acceptance screen creates a `LOCAL` identity for the invited user.

The backend validates that:

- the invitation token is valid
- the invited user exists
- the submitted email matches the invited account
- the password satisfies the configured password policy
- the user does not already have a local identity

When those checks pass:

- a local auth identity is created
- the invitation is marked accepted
- the user can sign in through the normal login form

## Authorization

Authorization remains internal to Blessing Tree.

Global application roles and campaign roles determine what a user can see and do. Authentication only proves who the user is; it does not grant additional app access.

## Routes

Current auth routes:

- `POST /api/v1/auth/local/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/invite/validate/<token>`
- `POST /api/v1/auth/invite/accept`

## Frontend Flow

The invitation screen should show:

- invited account summary
- display name
- email
- password field
- set-password action

The login screen should show:

- email field
- password field
- sign-in action

Third-party provider buttons should not be shown.

## Operational Notes

- Invitation emails should link to `/auth/register?token=...`.
- Expired or revoked invitations should fail validation clearly.
- Already accepted invitations should direct the user to sign in.
- Password reset should be handled separately from invitation acceptance.
