# Sponsor Drop-Off QR Design

Last updated: 2026-06-05

## Status

Phase 1 implemented on branch `codex/sponsor-dropoff-qr-workflow`.

Implemented:

- sponsor drop-off token table and SQLAlchemy model
- opaque token generation with hashed token storage
- authenticated campaign-scoped drop-off payload API
- protected `/mobile/receive/dropoff/:token` page
- mobile sponsor drop-off receive and immediate un-receive actions
- sponsor communication merge fields for drop-off URL, QR image, recipient IDs,
  and recipient/gift summary
- demo sponsor drop-off reminder template with QR image block and URL fallback
- Campaign Studio merge-field drawer entries for sponsor gift/drop-off fields

Not yet implemented:

- explicit token revocation UI
- separate scan-event table for sponsor drop-off links
- built-in camera scanner inside the mobile app
- phone-camera/manual QA against a real delivered email

This design builds on:

- `docs/engineering/mobile-operator-mode-design.md`
- `docs/engineering/sponsor-communication-send-design.md`
- `docs/engineering/gift-workflow-design.md`

## Purpose

Sponsors need an easy way to help staff find the correct committed gifts when
they arrive for gift drop-off. Staff should be able to scan a QR code from a
sponsor reminder/drop-off email and immediately see the sponsor's committed
recipient IDs and gift list in the mobile app.

The QR code should not contain all recipient and gift data directly. It should
contain a short, secure URL that resolves server-side to the current sponsor
drop-off payload.

## Product Goals

- Add a sponsor-specific QR code to drop-off reminder emails.
- Let staff scan the sponsor QR from a phone camera or scanner-capable mobile
  page.
- Open a mobile sponsor drop-off screen showing the sponsor, recipients, and
  committed gifts.
- Let staff receive and immediately un-receive gifts from that screen.
- Keep receiving actions authenticated and campaign-permission controlled.
- Keep QR codes short, revocable, and safe to include in email.
- Keep plain-text recipient IDs in the email as a fallback.

## Non-Goals

- No public unauthenticated ability to mark gifts received.
- No encoding complete gift/recipient details in the QR payload.
- No sponsor editing from the drop-off screen.
- No general camera-scanner framework beyond what is needed for sponsor
  drop-off and future recipient ID scanning.
- No offline receiving in the first release.

## Recommended User Flow

1. Staff sends a sponsor gift drop-off reminder email.
2. The email includes:
   - sponsor drop-off instructions
   - recipient IDs for the sponsor's committed gifts
   - gift summary/table
   - a QR code
   - a plain URL fallback
3. Sponsor arrives and shows the email.
4. Staff scans the QR code with the phone camera or mobile scanner.
5. The phone opens `/mobile/receive/dropoff/:token`.
6. If staff is not logged in, login redirects back to the same URL.
7. The mobile app resolves the token in the selected/authenticated campaign
   context.
8. Staff sees sponsor contact information and gifts grouped by recipient.
9. Staff taps Receive for each gift that arrived.
10. If a mistake is made, staff taps Undo while the item is still at
    `RECEIVED`.

## QR URL Shape

Recommended URL:

`https://<app-host>/mobile/receive/dropoff/<token>`

The token should be opaque. It should not expose sponsor IDs, recipient IDs, or
wishlist item IDs.

The token should resolve to a campaign/sponsor/sponsorship drop-off payload
server-side.

## Authentication And Authorization

The QR route must require staff authentication.

Rules:

- If unauthenticated, redirect to login and return to the QR URL after login.
- The authenticated user must have gift check-in permission for the campaign.
- The token must belong to a campaign the user can access.
- Receiving and un-receiving should use the same backend gift operation rules
  as the existing mobile receive page.

Do not allow public users or sponsors to mutate gift status through the QR.

## Token Model

Add a table for sponsor drop-off links.

Recommended table: `sponsor_dropoff_token`

Fields:

- `id`
- `campaign_id`
- `sponsorship_id`
- `sponsor_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `last_scanned_at`
- `created_by_user_id`
- `created_at`
- `updated_at`

Indexes:

- unique `token_hash`
- `campaign_id`
- `sponsorship_id`
- `sponsor_id`
- `expires_at`

Store only a hash of the token. The plain token is only used in the email URL.

## Token Lifecycle

Create or reuse an active token when rendering/sending a sponsor drop-off
communication.

Implemented lifecycle:

- create a fresh token when a sponsor communication is rendered/sent
- revoke older active tokens for the same sponsorship when creating a new token
- expire after the campaign ends or after a configurable number of days
- allow explicit revocation later if needed

Because only token hashes are stored, the app cannot reconstruct an older plain
token for repeat email rendering. Creating a fresh token per send preserves the
hashed-token security property and keeps the latest email authoritative.

If the sponsor's commitments change after email send, the token should resolve
the current committed gift state, not stale email-time data.

## Backend API

### Resolve Drop-Off Payload

`GET /api/v1/campaigns/:campaignId/mobile/dropoff/:token`

Permission:

- `campaign.gifts.check_in`

Response:

- campaign summary
- sponsor summary
- sponsorship summary
- grouped recipients
- committed wishlist items for each recipient
- current gift statuses
- receive/unreceive capability flags per item

Example shape:

```json
{
  "campaign_id": "uuid",
  "sponsor": {
    "id": "uuid",
    "display_name": "Rachel Morales",
    "email": "rachel@example.test",
    "phone": "2815551212"
  },
  "sponsorship": {
    "id": "uuid",
    "drop_off_status": "NOT_STARTED"
  },
  "recipients": [
    {
      "id": "uuid",
      "program_recipient_id": "BT-001",
      "display_label": "Child 1",
      "age": 8,
      "age_unit": "YEARS",
      "gender": "M",
      "group_label": "Alvarez Family",
      "gifts": [
        {
          "wishlist_item_id": "uuid",
          "description": "Batman action figure",
          "size": null,
          "status": "COMMITTED",
          "received_at": null,
          "can_receive": true,
          "can_unreceive": false
        }
      ]
    }
  ]
}
```

### Record Scan

Resolving the payload should update `last_scanned_at`. A separate scan event
table is optional but useful later.

If adding scan events now, use:

`POST /api/v1/campaigns/:campaignId/mobile/dropoff/:token/scan`

For first implementation, updating `last_scanned_at` on successful resolve is
enough.

### Gift Operations

Reuse existing endpoints:

- `POST /api/v1/campaigns/:campaignId/gifts/:wishlistItemId/receive`
- `POST /api/v1/campaigns/:campaignId/gifts/:wishlistItemId/unreceive`

Do not create token-specific receive endpoints unless authorization or audit
requirements later require it.

## Email Merge Fields

Add sponsor drop-off QR merge fields for sponsor-oriented templates.

Recommended fields:

| Field | Meaning |
| --- | --- |
| `{{gift.dropoff_qr_url}}` | Plain URL to mobile sponsor drop-off page. |
| `{{gift.dropoff_qr_image}}` | Inline QR image for HTML emails. |
| `{{gift.dropoff_recipient_ids}}` | Plain text recipient IDs tied to committed gifts. |
| `{{gift.dropoff_recipient_summary}}` | Recipient/gift summary suitable for text fallback. |

The existing gift fields such as `{{gift.items_table}}` should continue to
work.

## QR Rendering In Email

Use an inline image for HTML email:

- generate QR PNG or SVG server-side
- embed as CID attachment if the email service supports it, or as a data URI
  only if the current email clients support it reliably
- include the plain URL below the QR

Keep the QR visually simple:

- black and white
- high contrast
- enough quiet zone
- not too small for printing or phone scanning

## Mobile Drop-Off Page

Route:

- `/mobile/receive/dropoff/:token`

Screen layout:

- sponsor header
- sponsor phone/email
- drop-off status
- recipient sections
- gift rows under each recipient
- Receive button for gifts below `RECEIVED`
- Undo button for gifts exactly at `RECEIVED`
- disabled state for gifts beyond `RECEIVED`

Recipient section header:

- recipient ID
- recipient name/label
- age/gender
- family or organization

Gift row:

- description
- size/details
- status
- Receive/Undo action
- optional note panel for substitutions

## In-App Scanner

The sponsor email QR can work immediately through the phone's native camera
because it is a URL. A built-in scanner is useful but should be a later layer.

When added:

- add a Scan action on `/mobile/receive`
- request camera permission only after the user taps Scan
- scan QR URLs and route internally
- scan recipient IDs or gift label QR codes later through the same scanner
  component
- provide manual entry fallback if camera permission fails

Recommended library requirements:

- maintained browser QR decoder
- works in iOS Safari and Android Chrome
- no heavy desktop-only dependencies
- can be lazy-loaded so normal mobile pages stay light

## Audit And Traceability

Receiving and un-receiving already create gift operation/audit events.

Additional audit/logging should capture:

- token created
- sponsor reminder sent with QR
- token resolved/scanned
- token revoked if revocation is added

The receiving action itself should continue to record the actor user ID, not
the sponsor.

## Failure States

Handle:

- token not found
- token expired
- token revoked
- campaign mismatch
- user lacks campaign permission
- sponsor has no committed gifts
- gift already received or advanced past `RECEIVED`
- camera permission denied if in-app scanner is added

Error copy should be short and operational:

- "This drop-off link is expired."
- "You do not have access to this campaign."
- "No committed gifts are currently tied to this sponsor."
- "This gift has moved past receive. Use the full site to correct it."

## Testing Expectations

Backend:

- token generation stores only hash
- token resolve requires authentication
- token resolve requires campaign gift check-in permission
- token resolve rejects expired/revoked tokens
- token resolve returns committed gifts grouped by recipient
- payload updates when commitments change after token creation
- receive and unreceive still enforce campaign scoping

Frontend:

- QR route redirects through login and returns to the same route
- drop-off page renders sponsor header and grouped recipients
- Receive updates a gift row in place
- Undo updates a gift row in place
- gifts beyond `RECEIVED` disable mobile correction
- token error states render clearly

Manual:

- scan QR from an actual email on iOS Safari
- scan QR from an actual email on Android Chrome
- verify plain URL fallback opens the same page
- verify staff login is required
- verify sponsor cannot use QR to mutate gift status without staff login

## Implementation Plan

1. Add sponsor drop-off token model and migration.
2. Add token service for create/reuse/resolve/revoke.
3. Add authenticated drop-off payload API.
4. Add mobile drop-off page route.
5. Reuse mobile receive/unreceive controls on the drop-off page.
6. Add sponsor communication merge fields for QR URL, QR image, and recipient
   IDs.
7. Render QR in sponsor drop-off reminder email.
8. Add backend/frontend tests.
9. Smoke-test with real phone camera scanning.

## Recommended Sequencing

Finish the core mobile implementation first unless sponsor drop-off QR is
needed for an immediate demo or operational event.

Reason:

- the sponsor QR flow depends on mobile receive/unreceive being stable
- the remaining mobile search pages are smaller and complete the operator shell
- after the mobile surfaces are finished, the QR page can reuse the same cards,
  actions, and detail patterns

If users need the drop-off QR for a near-term walkthrough, implement the sponsor
drop-off QR next and postpone mobile Gift/Sponsor/Group search.
