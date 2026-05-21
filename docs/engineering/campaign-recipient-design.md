# Campaign Recipient Design

Last updated: 2026-05-21

## Status

- Proposed and accepted for implementation planning on 2026-05-21

Related design:

- `docs/engineering/campaign-api-design.md`
- `docs/engineering/campaign-studio-design.md`
- `docs/engineering/campaign-team-design.md`

## Purpose

Blessing Tree currently serves two distinct recipient programs:

- children in household/family intake flows
- adults in nursing-home intake flows

Both programs share one important operational truth:

- the gift receiver is always an individual person
- each individual person can have one wishlist
- intake and contact context may belong to a larger container around that person

The current schema is close, but the meaning is split awkwardly across:

- `recipient_group`
- `recipient_type`
- `group_contact`

This design refines the existing model so it supports both programs cleanly
without splitting the downstream fulfillment pipeline into separate tables.

## Summary

Keep the current core structure:

- `recipient_group`
- `group_contact`
- `recipient`
- `wishlist`
- `wishlist_item`

Refine the model so it expresses three different concerns clearly:

1. group/container context
2. recipient identity
3. program/workflow type

Recommended direction:

- `recipient_group` remains the intake/container record
- `group_contact` remains the parent/guardian/staff contact record
- `recipient` remains the actual gift receiver
- `wishlist` stays one-per-recipient
- `wishlist_item` remains the downstream sponsorship/fulfillment unit
- `recipient_type` should evolve into `recipient_kind`
- add a new `program_type` on `recipient`
- `recipient_group.group_type` should describe the container, not the person

This keeps one unified operational pipeline for:

- wishlists
- sponsorship
- donations
- fulfillment
- label printing
- pickup
- reporting

## Locked Decisions

### One Recipient Table

Use one `recipient` table for all gift receivers.

Do not split children and nursing-home adults into separate entity tables.

Rationale:

- both are gift recipients
- both need wishlists
- both participate in the same downstream sponsorship and fulfillment flow
- separate tables would create avoidable duplication across the entire pipeline

### Contacts Are Not Recipients

Parents, guardians, social workers, and facility staff are operational contacts.

They should remain in `group_contact`, not `recipient`.

Rationale:

- they are not the gift target
- they need different communication and authorization behavior
- keeping them separate helps later with pickup, privacy, and messaging

### One Wishlist Per Recipient

Each recipient should have at most one wishlist per campaign.

Rationale:

- this already matches the current model
- it keeps sponsorship and fulfillment simple
- it supports both children and nursing-home adults cleanly

### Group Is The Intake Container

`recipient_group` should represent the shared intake and contact context around
one or more recipients.

Examples:

- one household with multiple children
- one nursing-home unit/facility batch with multiple adult recipients

### Program Type Must Be Explicit

The model should distinguish:

- who the recipient is
- which business program/workflow they belong to

Rationale:

- `SENIOR` is not really a person type for this app
- the real workflow distinction is:
  - family child intake
  - nursing-home adult intake

## Domain Model

### 1. Recipient Group

`recipient_group` remains the shared intake container.

Meaning:

- the shared context recipients belong to
- the place where address, source, and shared contacts live

Recommended `group_type` values:

- `HOUSEHOLD`
- `CARE_FACILITY`

Recommended fields:

- `id`
- `campaign_id`
- `group_type`
- `group_name`
- `intake_source`
- `external_reference` nullable
- `address_line1`
- `address_line2`
- `city`
- `state`
- `postal_code`
- `notes`
- `status`
- timestamps

Recommended `status` values:

- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

Examples:

- `Johnson Household`
- `Maple Grove - West Wing`

### 2. Group Contact

`group_contact` remains the operational contact record attached to a group.

Use it for:

- parents
- guardians
- social workers
- facility staff
- intake coordinators

Recommended fields:

- `id`
- `recipient_group_id`
- `contact_role`
- `relationship_label` nullable
- `first_name`
- `last_name`
- `email`
- `phone`
- `preferred_contact`
- `is_primary`
- `can_pick_up`
- `is_emergency_contact`
- `notes`
- timestamps

Recommended `contact_role` values:

- `PARENT`
- `GUARDIAN`
- `SOCIAL_WORKER`
- `STAFF`
- `COORDINATOR`
- `OTHER`

Notes:

- `can_pick_up` is useful later for pickup authorization
- `relationship_label` gives flexibility without pushing too much into enums

### 3. Recipient

`recipient` remains the actual gift receiver.

This is the center of the recipient domain.

Recommended fields:

- `id`
- `campaign_id`
- `recipient_group_id`
- `recipient_kind`
- `program_type`
- `privacy_level`
- `display_label`
- `first_name`
- `last_name`
- `birth_year` nullable
- `age` nullable
- `gender` nullable
- `direct_email` nullable
- `direct_phone` nullable
- `facility_room` nullable
- `subgroup_label` nullable
- `mobility_notes` nullable
- `notes`
- `status`
- timestamps

Recommended `recipient_kind` values:

- `CHILD`
- `ADULT`

Recommended `program_type` values:

- `CHILD_FAMILY`
- `NURSING_HOME`

Recommended `privacy_level` values:

- `ANONYMOUS`
- `INITIALS`
- `FULL_NAME`

Recommended `status` values:

- `ACTIVE`
- `INACTIVE`

Important rules:

- children typically use parent/guardian contacts through `group_contact`
- nursing-home adults may still have direct recipient-level information
- a nursing-home adult still belongs to a facility group for operational context

### 4. Wishlist

Keep one `wishlist` per `recipient`.

Recommended fields:

- `id`
- `campaign_id`
- `recipient_id`
- `wishlist_status`
- `intake_method` nullable
- `submitted_at` nullable
- `intake_completed_by_contact_id` nullable
- `notes`
- timestamps

Recommended `wishlist_status` values:

- `DRAFT`
- `READY`
- `LOCKED`

Recommended `intake_method` values:

- `PHONE`
- `FORM`
- `STAFF_ENTRY`
- `IMPORT`
- `OTHER`

### 5. Wishlist Item

The current `wishlist_item` model is already appropriate as the fulfillment unit.

Recommended additive fields:

- `item_type`
- `recipient_note`
- `do_not_substitute_reason`

Recommended `item_type` values:

- `GIFT`
- `CLOTHING`
- `ESSENTIAL`
- `GIFT_CARD`
- `EXPERIENCE`
- `OTHER`

## Example Data Shapes

### Household / Child Program

`recipient_group`

- `group_type = HOUSEHOLD`
- `group_name = Johnson Household`

`group_contact`

- `PARENT` mother
- `PARENT` father

`recipient`

- Ava Johnson
  - `recipient_kind = CHILD`
  - `program_type = CHILD_FAMILY`
  - `age = 8`
  - `gender = F`
- Noah Johnson
  - `recipient_kind = CHILD`
  - `program_type = CHILD_FAMILY`
  - `age = 5`
  - `gender = M`

### Nursing Home / Adult Program

`recipient_group`

- `group_type = CARE_FACILITY`
- `group_name = Maple Grove - West Wing`

`group_contact`

- `SOCIAL_WORKER`
- `STAFF`

`recipient`

- Mary Smith
  - `recipient_kind = ADULT`
  - `program_type = NURSING_HOME`
  - `age = 84`
  - `facility_room = 214B`
- James Carter
  - `recipient_kind = ADULT`
  - `program_type = NURSING_HOME`
  - `age = 79`
  - `facility_room = 216A`

## What Should Change From The Current Model

### Keep

- `recipient_group`
- `group_contact`
- `recipient`
- `wishlist`
- `wishlist_item`

### Rename / Refine

- `recipient_group.group_type`
  - from `HOUSEHOLD | INSTITUTION`
  - to `HOUSEHOLD | CARE_FACILITY`

- `recipient.recipient_type`
  - from `CHILD | ADULT | SENIOR`
  - to `recipient_kind = CHILD | ADULT`

- add `recipient.program_type`
  - `CHILD_FAMILY | NURSING_HOME`

### Add

On `recipient_group`:

- `external_reference`
- `status`

On `group_contact`:

- `relationship_label`
- `can_pick_up`
- `is_emergency_contact`

On `recipient`:

- `program_type`
- `birth_year` or future `date_of_birth`
- `direct_email`
- `direct_phone`
- `facility_room`
- `mobility_notes`

On `wishlist`:

- `wishlist_status`
- `intake_method`
- `submitted_at`
- `intake_completed_by_contact_id`

On `wishlist_item`:

- `item_type`
- `recipient_note`
- `do_not_substitute_reason`

## What Should Not Change

### Do Not Create Separate Child And Adult Recipient Tables

That would fragment:

- wishlist handling
- sponsorship
- fulfillment
- reporting

### Do Not Put Parents In The Recipient Table

Parents and guardians are contacts, not gift recipients.

### Do Not Treat Facility Staff As Recipients

They are still contacts, even when they are the primary intake and pickup point.

### Do Not Make Nursing-Home Adults Their Own Top-Level Program Table

They should remain normal recipients inside a facility-scoped intake container.

## API Direction

Recommended feature package:

- `app/features/recipients/`

Recommended base path:

- `/api/v1/campaigns/<campaign_id>/recipients`

Recommended resources:

### Group APIs

- `GET /groups`
- `POST /groups`
- `GET /groups/<group_id>`
- `PATCH /groups/<group_id>`
- `POST /groups/<group_id>/contacts`
- `PATCH /groups/<group_id>/contacts/<contact_id>`

### Recipient APIs

- `GET /`
- `POST /`
- `GET /<recipient_id>`
- `PATCH /<recipient_id>`

### Wishlist APIs

- `GET /<recipient_id>/wishlist`
- `PUT /<recipient_id>/wishlist`
- `POST /<recipient_id>/wishlist/items`
- `PATCH /<recipient_id>/wishlist/items/<item_id>`

Recommended list filters:

- `group_type`
- `program_type`
- `recipient_kind`
- `status`
- `search`

## UI Direction

Recommended campaign child area:

- `Recipients`

Recommended workspace structure:

1. top summary cards
2. groups table or rail
3. recipients table
4. drawers for:
   - group
   - contact
   - recipient
   - wishlist

Recommended intake experiences:

### Child / Household Intake

- create household
- add parent/guardian contacts
- add one or more child recipients
- add wishlist per child

### Nursing Home Intake

- create facility/unit group
- add staff/social-worker contacts
- add one or more adult recipients
- add wishlist per adult

This should be one domain workspace with workflow-aware forms, not two separate
products.

## Communications / Automation Implications

This design also clarifies who campaign communications target.

Future audiences can cleanly support:

- parent/guardian contacts for household recipients
- facility contacts for nursing-home recipients
- direct recipients where appropriate

That means communication resolution should eventually understand:

- group contacts by role
- recipient direct contact fields
- recipient `program_type`

## Migration Strategy

The current schema is already close enough for an additive refinement path.

Recommended sequencing:

### Phase 1

- add new columns and enums
- keep old columns readable for compatibility

### Phase 2

- update ORM models and serializers
- backfill:
  - `INSTITUTION -> CARE_FACILITY`
  - `SENIOR -> recipient_kind=ADULT, program_type=NURSING_HOME`
  - `CHILD -> program_type=CHILD_FAMILY`
  - `ADULT -> program_type=NURSING_HOME` where current data is in institution groups

### Phase 3

- build recipient APIs on the refined model
- build the first recipient workspace UI

### Phase 4

- update communications audience resolution
- update reporting to use `program_type`

### Phase 5

- remove deprecated compatibility paths once data is migrated cleanly

## Recommendation

Do not replace the current recipient model.

Refine it into a cleaner expression of:

- shared intake container
- operational contacts
- actual gift recipients
- recipient-specific wishlists

The right long-term model is:

- `recipient_group` for shared context
- `group_contact` for parents/guardians/staff
- `recipient` for the actual person receiving gifts
- `wishlist` and `wishlist_item` for requested gifts
- explicit `program_type` for workflow behavior

That will support both:

- children in family intake flows
- adults in nursing-home flows

without breaking the downstream gift pipeline into multiple incompatible models.
