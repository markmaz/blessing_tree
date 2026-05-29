# Sponsor Communication Send Design

Last updated: 2026-05-27

## Status

Implementation started on branch `codex/sponsor-communication-send`.

Open product questions answered on 2026-05-27 and incorporated below. The
backend foundation, Sponsor Drawer sender, explicit Send Now targeting, and
send history recipient detail drawer are implemented locally on the feature
branch.

This design extends Campaign Studio communications so staff can send a campaign
communication template directly from an individual sponsor record. The first
target use case is a gift reminder email that lists the gifts a sponsor has
committed to provide.

Related documents:

- `docs/engineering/campaign-studio-design.md`
- `docs/engineering/campaign-sponsor-workspace-design.md`
- `docs/engineering/gift-workflow-design.md`
- `docs/engineering/campaign-team-design.md`

## Problem

Campaign Communications currently has an `audience` field on templates and
schedules, but not a visible `To` field. For scheduled communications, the
backend resolves recipients implicitly from the template audience. That works
for campaign-wide sends, but it is not obvious to users and does not support
direct operational sends from a specific sponsor screen.

Users need to:

1. Create reusable campaign communication templates in Campaign Studio.
2. Select an active sponsor template from an individual sponsor record.
3. Preview the email with sponsor-specific and gift-specific merge fields.
4. Send the email to that sponsor.
5. Record the send in the sponsor communication log and update last contacted.

The same design should also clarify how campaign communications choose
recipients when the user is sending to teams, sponsors, volunteers, recipients,
or manual email addresses.

## Current Behavior

### Templates

`communication_template` stores:

- campaign
- template key
- name
- audience
- channel
- subject template
- body template
- active flag

The audience is template metadata and also drives scheduled send recipient
resolution.

### Scheduled Sends

`campaign_communication_schedule` stores a template and timing. When the worker
dispatches a scheduled communication, it resolves the template audience through
`CampaignRecipientResolver`.

This means "To" is implicit:

- Sponsors means active sponsors attached to sponsorships in the campaign.
- Campaign Managers means campaign members/users with manager access.
- Volunteers means campaign members marked volunteer.
- Household/organization contacts resolve from recipient group contacts.

### Test Sends

Template test email supports a one-off recipient email. It does not represent a
real campaign send and should not be used for sponsor reminders.

## Goals

1. Add direct sponsor email send from the Sponsor Drawer.
2. Reuse campaign communication templates instead of creating sponsor-only
   templates.
3. Add gift commitment merge fields for sponsor templates.
4. Make recipient targeting explicit in Campaign Communications.
5. Keep a durable audit trail for real sends.
6. Record successful sponsor sends in the sponsor interaction log.
7. Support future sends to selected teams, sponsors, campaign members, recipient
   contacts, and manual addresses.

## Non-Goals For First Release

- Bulk selected-recipient campaign send UI.
- Email open/click tracking.
- Email delivery provider webhooks.
- Attachments.
- SMS.
- Per-recipient unsubscribe management.
- Rich segmentation beyond current audience resolvers.

## Proposed Concepts

### Template

A reusable campaign-level message body. Templates answer:

- What message should be sent?
- Which audience type is this designed for?
- What merge fields are expected?

Templates should not answer the final operational question: exactly who receives
this send right now?

### Recipient Target

A concrete recipient selection for a send action. Recipient target answers:

- Who should receive this communication?

Target modes:

| Mode | Description | First Release |
| --- | --- | --- |
| `CONTEXT_SPONSOR` | One sponsor from the Sponsor Drawer. | Yes |
| `AUDIENCE` | Everyone resolved by template audience. | Existing scheduled sends |
| `TEAM` | One or more campaign teams. | Later |
| `SELECTED` | Explicit selected sponsors, members, teams, or contacts. | Later |
| `MANUAL_EMAIL` | One or more manually entered email addresses. | Later |

### Communication Send

A real send event. It should capture:

- campaign
- template
- target mode
- rendered subject
- recipient count
- sent count
- failed count
- send status
- user who initiated the send
- timestamp
- error summary when applicable

For the first sponsor-drawer implementation, this can be logged through existing
automation execution plus sponsor interaction, or through a new lightweight
table. A new table is cleaner and makes future "Sent Communications" history
easy to expose.

Recommended table:

`campaign_communication_send`

Fields:

- `id`
- `campaign_id`
- `template_id`
- `target_mode`
- `status`
- `subject`
- `recipient_count`
- `delivered_count`
- `failed_count`
- `error_message`
- `created_by_user_id`
- `created_at`

Required child table:

`campaign_communication_send_recipient`

- `id`
- `send_id`
- `recipient_type`
- `recipient_ref_id`
- `email`
- `display_name`
- `status`
- `error_message`
- `sent_at`

Decision: include both tables in the first implementation. Manual sponsor sends
should be visible in Campaign Studio communication history and in the Sponsor
Drawer communication log.

## Sponsor Gift Merge Fields

Sponsor audience templates should support sponsor identity and gift commitment
fields.

### Existing Sponsor Fields

| Field | Meaning |
| --- | --- |
| `{{sponsor.first_name}}` | Sponsor first name derived from display name. |
| `{{sponsor.full_name}}` | Sponsor display name. |

### New Sponsor Fields

| Field | Meaning |
| --- | --- |
| `{{sponsor.email}}` | Sponsor email address. |
| `{{sponsor.phone}}` | Sponsor phone number when available. |

### New Gift Commitment Fields

| Field | Meaning |
| --- | --- |
| `{{gift.commitment_count}}` | Number of active gifts committed by this sponsor. |
| `{{gift.commitment_summary}}` | Short plain-language summary of committed gifts. |
| `{{gift.items_list}}` | Plain text or HTML list of committed gifts. |
| `{{gift.items_table}}` | HTML table for email body and plain text fallback for text email. |
| `{{gift.awaiting_turn_in_list}}` | Gifts below received status, intended for reminder emails. |
| `{{gift.awaiting_turn_in_table}}` | HTML table of gifts below received status. |
| `{{gift.received_or_later_list}}` | Gifts at received status or later, intended for thank-you/status emails. |
| `{{gift.received_or_later_table}}` | HTML table of gifts at received status or later. |
| `{{gift.recipient_names}}` | Comma-separated recipient display names for committed gifts. |
| `{{gift.due_date}}` | Campaign gift turn-in/due date when configured. |
| `{{gift.dropoff_instructions}}` | Campaign-level drop-off instructions when configured. |

The user decides which list/table merge field to use in the template. Reminder
templates should normally use the awaiting-turn-in fields. Thank-you or status
templates should normally use the received-or-later fields.

Recommended first template:

Subject:

```text
Reminder: gifts you committed for {{campaign.name}}
```

Body:

```text
Hi {{sponsor.first_name}},

Thank you for sponsoring gifts for {{campaign.name}}.

Here are the gifts currently committed to you:

{{gift.items_table}}

Please turn them in by {{gift.due_date}}.
```

## Gift Commitment Data Rules

The sponsor reminder should include active gifts tied to the sponsor for the
current campaign.

Include gift rows when:

- sponsor is active
- sponsorship belongs to the campaign
- sponsorship item is active/current
- wishlist item is not cancelled/deleted

Suggested columns for gift tables:

- public-safe recipient label
- family/group name
- gift/wish description
- status
- quantity if relevant

Do not include:

- internal database IDs
- private recipient contact information
- addresses
- QR label codes

### Gift Status Grouping

Gift commitment merge fields should expose both complete and status-filtered
views.

Default groupings:

- `all_committed`: all active committed gifts, regardless of workflow status
- `awaiting_turn_in`: committed gifts with status before `RECEIVED`
- `received_or_later`: committed gifts with status `RECEIVED` or later

This keeps the feature flexible without requiring a special template type for
each use case.

### Public-Safe Recipient Label

Sponsor-facing communication should not rely on raw/internal recipient names.
Add a public-safe recipient label for recipient merge fields and gift reminder
content.

Recommended source order:

1. recipient-specific public label when present
2. configured recipient display label
3. first name plus last initial
4. safe fallback such as `Recipient`

The public-safe label should also be considered for gift tags and future public
communications, but this implementation only requires it for sponsor
communications.

### Gift Due Milestone

`{{gift.due_date}}` should come from a campaign milestone, not from a template
or one-off send setting.

Recommended milestone key:

```text
gift_turn_in_due
```

Decision: use `gift_turn_in_due`.

Add readiness measures/rules so `gift_turn_in_due` is a blocker when sponsor
reminder templates or sponsor communication sends depend on `{{gift.due_date}}`.

## Sponsor Drawer UX

Add a `Send Email` action in the Communication section of the Sponsor Drawer.

### Entry Point

Location:

- Sponsor Drawer
- Communication section
- Near `Add Interaction`

Button:

- `Send Email`
- disabled when sponsor has no email
- disabled until sponsor is saved

### Send Drawer/Modal

Fields:

- Template dropdown
  - active templates only
  - `audience = SPONSOR`
  - `channel = EMAIL`
- To
  - sponsor display name and email
  - read-only for first release
- Subject preview
- Body preview
- Gift commitment preview
- Warning banner when the selected template references gift merge fields but
  the sponsor has no matching gifts for that field group
- Send button

States:

- no sponsor email
- no active sponsor templates
- no committed gifts, shown as a warning rather than a hard block
- preview loading
- send in progress
- send success
- send failure

### After Send

On successful send:

- send email
- create sponsor interaction
  - channel: `EMAIL`
  - direction: `OUTBOUND`
  - origin type: `CAMPAIGN_COMMUNICATION`
  - outcome: `SENT`
  - summary/notes include template name and subject
- refresh interaction log
- update sponsor last contacted
- show confirmation

On failure:

- show error
- record failed communication send if send table exists
- do not create a successful sponsor interaction

## Campaign Communications UX

Campaign Studio should separate three concerns:

1. Templates
2. Schedules
3. Sends/Recipients

The current template editor should remain focused on content. The missing `To`
concept should appear in send/schedule actions, not as a generic free-form field
on every template.

### Template Audience

Keep audience on the template because it:

- filters merge fields
- filters where templates are offered
- provides a default targeting group

Rename or clarify UI copy:

- Current: `Audience`
- Recommended label: `Intended Audience`

Helper text:

```text
Used for merge fields and default recipient targeting. You choose exact recipients when sending or scheduling.
```

### Schedule Communication

When scheduling a communication, show:

- Template
- Intended audience
- Resolved recipient count
- Preview recipients link or drawer

This answers: "Who will this go to when the schedule runs?"

### Send Now

Add later:

- Template
- To mode
  - all intended audience
  - selected recipients
  - manual email
- recipient preview
- send now

This can reuse the same send service built for the Sponsor Drawer.

### First-Class Recipient Targets

Campaign Communications should support first-class targeting for:

- teams
- sponsors
- organization contacts
- family/household contacts
- campaign managers
- volunteers
- selected individuals
- manual individual email addresses

Manual individual sends should be allowed for real sends, not limited to test
emails. The UI should make these explicit and auditable so staff can understand
exactly who received the message.

## Backend Design

### New Service

Add:

`CampaignCommunicationSendService`

Responsibilities:

- validate template belongs to campaign
- validate template is active and email channel
- build recipient target
- build merge fields
- render subject/body
- send email
- record send result
- create sponsor interaction when target is a sponsor

### Sponsor Send Endpoint

Add:

```text
POST /api/v1/campaigns/:campaignId/sponsors/:sponsorId/communications/send
```

Payload:

```json
{
  "template_id": "uuid",
  "preview_only": false
}
```

Response:

```json
{
  "send_id": "uuid",
  "template_id": "uuid",
  "sponsor_id": "uuid",
  "recipient_email": "sponsor@example.com",
  "subject": "Reminder: gifts you committed for Blessing Tree 2026",
  "status": "SENT"
}
```

The `To` recipient is locked to the sponsor email on file for sponsor-drawer
sends. This preserves audit clarity. If the email is wrong, staff should update
the sponsor record first.

### Sponsor Preview Endpoint

Add:

```text
POST /api/v1/campaigns/:campaignId/sponsors/:sponsorId/communications/preview
```

Payload:

```json
{
  "template_id": "uuid"
}
```

Response:

```json
{
  "template_id": "uuid",
  "recipient_email": "sponsor@example.com",
  "subject": "Reminder: gifts you committed for Blessing Tree 2026",
  "html": "<html>...</html>",
  "text": "Hi Jane...",
  "merge_fields": {
    "gift.commitment_count": "3",
    "gift.recipient_names": "Ava, Noah"
  }
}
```

### Future Generic Send Endpoint

Add later:

```text
POST /api/v1/campaigns/:campaignId/communications/send
```

Payload:

```json
{
  "template_id": "uuid",
  "target_mode": "AUDIENCE",
  "recipient_ids": [],
  "manual_emails": []
}
```

Supported first-class target modes should include:

- `AUDIENCE`
- `TEAM`
- `SELECTED_SPONSORS`
- `SELECTED_CONTACTS`
- `SELECTED_MEMBERS`
- `MANUAL_EMAIL`

## Frontend Design

### API Client

Add functions to `campaignSponsorWorkspaceApi.ts`:

- `previewCampaignSponsorCommunication`
- `sendCampaignSponsorCommunication`

Add types:

- `SponsorCommunicationTemplateOption`
- `SponsorCommunicationPreview`
- `SponsorCommunicationSendResult`

### Sponsor Drawer

Add local state:

- selected template
- preview
- loading preview
- sending
- send error
- send success

Recommended component split:

- `CampaignSponsorCommunicationSendModal`
- `SponsorCommunicationPreview`

The Sponsor Drawer is already large. The send UI should be its own component to
avoid making the drawer harder to maintain.

Current implementation note: the first UI slice keeps the sender inline inside
the existing Communication Log section so users can pick, preview, warn, send,
and immediately see the refreshed interaction log without another overlay. If
the drawer grows further, extract this into a dedicated component before adding
generic send targets.

### Template Loading

Options:

1. Load sponsor templates when drawer opens.
2. Pass campaign communication templates down from a campaign-level context.

Recommendation:

For first release, reuse the existing campaign communication template list and
filter active sponsor email templates in the client. This avoids adding another
read endpoint while the generic communication send model is still evolving.

Possible later endpoint:

```text
GET /api/v1/campaigns/:campaignId/communications/templates?audience=SPONSOR&active=true
```

If filtering existing list templates is easier in current API, reuse it.

## Security And Permissions

Sending a sponsor email should require one of:

- campaign manager
- sponsor admin
- admin/global coordinator equivalent if currently permitted by campaign access

Do not allow:

- public sponsor users
- unrelated campaign users
- users with view-only access

The send endpoint must verify:

- sponsor belongs to campaign
- template belongs to campaign
- template audience is `SPONSOR`
- template is active
- sponsor has a valid email

Manual individual sends must be recorded per recipient in
`campaign_communication_send_recipient`.

## Audit And History

First release should record both campaign-level send history and sponsor-level
outcome.

Minimum:

- create `SponsorInteraction` on success
- update sponsor last contacted
- create `campaign_communication_send`
- create `campaign_communication_send_recipient`

Recommended:

- expose send history in Campaign Studio
- expose sponsor-specific communication history in the Sponsor Drawer

This supports future reports:

- communications sent by campaign
- failed sends
- who received a template
- sponsor reminder history

## Implementation Plan

### Phase 1: Backend Sponsor Send Foundation

1. Add `campaign_communication_send` and
   `campaign_communication_send_recipient` tables.
2. Add public-safe recipient label support for sponsor-facing gift content.
3. Add sponsor gift merge-field builder with all/awaiting/received-or-later
   field groups.
4. Add gift turn-in due milestone support.
5. Add communication send service.
6. Add sponsor preview endpoint.
7. Add sponsor send endpoint.
8. Record sponsor interaction on successful send.
9. Add API tests for:
   - sponsor gift fields render
   - missing sponsor email blocks send
   - wrong audience template blocks send
   - no matching gifts returns warning metadata
   - successful send records interaction
   - successful send records campaign send and recipient rows

### Phase 2: Sponsor Drawer UI

1. Add sponsor template picker.
2. Add preview modal/drawer.
3. Add send action.
4. Add warning when gift-specific template fields have no matching gifts.
5. Refresh interaction log after successful send.
6. Add UI tests for:
   - no email disabled state
   - template selection
   - preview loading
   - no matching gifts warning
   - successful send

### Phase 3: Campaign Communications Recipient Clarity

1. Rename `Audience` label to `Intended Audience`.
2. Add recipient count preview for schedule editor.
3. Add "View recipients" drawer for resolved audience.
4. Add communication send history section.
5. Add help copy explaining exact recipients are chosen when sending or
   scheduling.

### Phase 4: Generic Send Now

1. Add generic send endpoint.
2. Add Send Now panel to Campaign Communications.
3. Support audience, team, selected sponsor/contact/member, and manual email
   target modes.
4. Add recipient preview before sending.
5. Record per-recipient send rows.

### Phase 5: Team And Selected Recipient Targeting

1. Add team recipient resolver.
2. Add selected sponsor/member/contact picker.
3. Persist send recipient rows.
4. Add communication history screen.

Implementation note: the Campaign Studio communication history panel now opens
a detail drawer for each send with per-recipient delivery rows. A separate
navigation screen is not required for the current workflow unless users need
history search/export later.

Implementation note: resolved audience recipients are exposed in the studio
payload and can be viewed from both the Schedule communication editor and the
Send Now audience preview before staff save or send.

## Testing Strategy

Backend:

- merge-field builder unit tests
- sponsor send API tests
- permission tests
- template audience validation tests
- email send mocked tests

Frontend:

- Sponsor Drawer send modal tests
- template dropdown filtering tests
- preview and send state tests
- disabled state tests for missing email

Manual QA:

- create sponsor template in Campaign Studio
- commit gifts to sponsor
- open sponsor drawer
- preview reminder
- send reminder
- verify email content includes gifts
- verify sponsor interaction log updates

## Open Questions

Resolved decisions:

1. Sponsor gift merge fields should expose multiple lists/tables so users can
   decide how to use them:
   - all committed gifts
   - gifts awaiting turn-in
   - gifts received or later
2. Sponsor-level `To` is locked to the sponsor email on file.
3. Sponsors with no matching gifts should show a warning, not a hard block.
4. Add send history tables in the first implementation.
5. Manual sponsor sends should appear in both Campaign Studio communication
   history and the Sponsor Drawer.
6. Teams, sponsors, organization contacts, family/household contacts, selected
   individuals, and manual email addresses should be first-class recipient
   targets.
7. Gift due date should come from a campaign milestone.
8. Gift lists should use a public-safe recipient label.

No open product questions remain before implementation.
