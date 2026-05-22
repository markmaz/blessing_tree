# Campaign Recipient Design

Last updated: 2026-05-22

## Status

- Proposed and accepted for implementation planning on 2026-05-21
- Implementation sequencing is now documented in:
  - `docs/engineering/campaign-recipient-implementation-plan.md`

Related design:

- `docs/engineering/campaign-api-design.md`
- `docs/engineering/campaign-studio-design.md`
- `docs/engineering/campaign-team-design.md`

## Purpose

Blessing Tree currently serves two distinct recipient contexts:

- children in household/family intake flows
- adults in adult-program intake flows, whether the submitting group is a
  facility, ministry, or partner organization

All three programs share one important operational truth:

- the gift receiver is always an individual person
- each individual person can have one wishlist
- intake and contact context may belong to a larger container around that person

The current schema is close, but the meaning is split awkwardly across:

- `recipient_group`
- `recipient_type`
- `group_contact`

This design refines the existing model so it supports all three programs cleanly
without splitting the downstream fulfillment pipeline into separate tables.

The current implementation has now simplified the adult side into one
`ADULT_PROGRAM` group/program shape, and the People workspace/reporting layer
now carries explicit workflow rollups for sponsorship, fulfillment, ready-for-
pickup, and picked-up status.

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

Do not split children and adult-program recipients into separate entity tables.

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
- it supports all recipient programs cleanly

### Group Is The Intake Container

`recipient_group` should represent the shared intake and contact context around
one or more recipients.

Examples:

- one household with multiple children
- one nursing-home unit/facility batch with multiple adult recipients
- one partner organization with multiple adult recipients in its submitted program

### Program Type Must Be Explicit

The model should distinguish:

- who the recipient is
- which business program/workflow they belong to

Rationale:

- `SENIOR` is not really a person type for this app
- the real workflow distinction is:
  - family child intake
  - adult-program intake

## Domain Model

### 1. Recipient Group

`recipient_group` remains the shared intake container.

Meaning:

- the shared context recipients belong to
- the place where address, source, and shared contacts live

Recommended `group_type` values:

- `HOUSEHOLD`
- `ADULT_PROGRAM`

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
- `Senior At Home`

### 2. Group Contact

`group_contact` remains the operational contact record attached to a group.

Use it for:

- parents
- guardians
- social workers
- facility staff
- intake coordinators
- partner-program coordinators

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
- `address_line1` nullable
- `address_line2` nullable
- `city` nullable
- `state` nullable
- `postal_code` nullable
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
- `ADULT_PROGRAM`

Recommended `privacy_level` values:

- `ANONYMOUS`
- `INITIALS`
- `FULL_NAME`

Recommended `status` values:

- `ACTIVE`
- `INACTIVE`

Important rules:

- children typically use parent/guardian contacts through `group_contact`
- adult-program recipients may optionally have direct recipient-level contact or address information
- an adult recipient still belongs to an adult-program group for coordination, reporting, and communication

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

### Adult Program

`recipient_group`

- `group_type = ADULT_PROGRAM`
- `group_name = Maple Grove - West Wing`

`group_contact`

- `SOCIAL_WORKER`
- `STAFF`

`recipient`

- Mary Smith
  - `recipient_kind = ADULT`
  - `program_type = ADULT_PROGRAM`
  - `age = 84`
  - `facility_room = 214B`
- James Carter
  - `recipient_kind = ADULT`
  - `program_type = ADULT_PROGRAM`
  - `age = 79`
  - `facility_room = 216A`

This same `ADULT_PROGRAM` shape also supports partner organizations such as
`Senior At Home`, where the group record holds the shared coordination context
and adult recipients optionally keep their own address, phone, and email.

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
  - to `HOUSEHOLD | ADULT_PROGRAM`

- `recipient.recipient_type`
  - from `CHILD | ADULT | SENIOR`
  - to `recipient_kind = CHILD | ADULT`

- add `recipient.program_type`
  - `CHILD_FAMILY | ADULT_PROGRAM`

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
- `address_line1`
- `address_line2`
- `city`
- `state`
- `postal_code`
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

### Do Not Make Adult Programs Their Own Top-Level Recipient Tables

They should remain normal recipients inside a campaign-scoped intake container,
whether that container is a facility or a partner program.

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

### Primary User-Facing Label

Use `People` in the product UI.

Do not use `Families` as the main navigation label because the domain now
includes both:

- household children
- adults in nursing-home/facility flows

Do not use `Recipients` as the primary UI label unless there is a strong need
for exact domain terminology in a specific view.

Recommendation:

- UI navigation and page title: `People`
- backend/domain terminology: `recipient`
- shared design terminology: `recipient domain`

### Campaign Scope

The People workspace must be campaign-scoped.

Recommended parent route:

- `/campaigns/:campaignId/people`

Recommended child routes:

- `/campaigns/:campaignId/people/intake`
- `/campaigns/:campaignId/people/directory`

Do not make this a global top-level non-campaign route.

Rationale:

- recipients belong to a campaign
- wishlists belong to a campaign
- intake varies by campaign year and operating context
- the same household or facility may appear differently across campaigns

### Workspace Shape

Recommended workspace structure:

1. `People` as the parent campaign section
2. child navigation:
   - `Intake`
   - `Directory`
3. workflow-aware drawers for:
   - group
   - contact
   - recipient
   - wishlist

This separates:

- new intake entry
- search and maintenance

That is closer to how intake workers actually think.

### Intake View

The `Intake` child page should be the primary entry point for new data entry.

Recommended first screen:

- `Add Family`
- `Add Facility`
- `Add Partner Program`

The page should feel like a workflow launcher, not a directory.

Recommended behavior:

- `Add Family` opens the household intake flow
- `Add Facility` opens the care-facility intake flow
- `Add Partner Program` opens the partner-program intake flow
- after a group is created, the same intake surface should keep users in context
  to add children or adults and then add wishlists

This is important because intake workers think in connected tasks:

- add a family
- add the children
- add their wishlists

or:

- open a facility intake
- add the residents
- add their wishlists

or:

- open a partner-program intake
- add the adult recipients
- add their wishlists

They are not thinking in abstract record types.

### Directory View

The `Directory` child page should be the searchable maintenance surface.

Recommended structure:

1. top summary cards
2. `Households, Facilities & Programs` section
3. `People` section

Recommended summary cards:

- `Groups`
- `People`
- `Wishlists`
- `Open Items`

These should remain compact and consistent with the Team and Readiness
workspace patterns already in the app.

#### Directory Section 1: Households, Facilities & Programs

This replaces the colder backend phrase `recipient groups` in the UI.

Use one table for intake containers.

Recommended columns:

- `Name`
- `Type`
- `Primary Contact`
- `People`
- `Status`

Row click should open the group drawer.

#### Directory Section 2: People

This is the actual gift-recipient table.

Recommended columns:

- `Name`
- `Program`
- `Group`
- `Age`
- `Gender`
- `Wishlist`
- `Status`

Row click should open the person drawer.

### Group Drawer

Recommended sections:

- group details
- address
- notes
- contacts
- linked children or residents

Recommended behaviors:

- allow add/edit/remove contacts
- allow add child/resident/adult recipient from inside the group drawer
- show linked children/residents/adults directly in the drawer so intake stays
  connected to the group context
- support household, facility, and partner-program entry through the same drawer shell

### Person Drawer

Recommended sections:

- person identity/details
- program fields
- group link
- wishlist summary
- notes/status

Recommended behaviors:

- open full wishlist editing from the person drawer
- show family-child vs facility-adult vs partner-program-adult fields conditionally based on
  `program_type`
- hide non-applicable direct-contact fields during contextual household-child
  intake so family contacts stay on the household record
- show optional recipient-level address/phone/email fields for facility adults
- show recipient-level address/phone/email fields prominently for partner-program adults

### Address Semantics

Both `recipient_group` and `recipient` may have address data, but they mean
different things:

- `recipient_group.address_*`
  - the shared coordination address for the family, facility, or partner program
- `recipient.address_*`
  - the actual recipient home/living address when the program requires it

UI rules:

- `HOUSEHOLD`
  - use the group/household address
  - hide recipient direct address, phone, and email
- `CARE_FACILITY`
  - use the facility/group address by default
  - allow optional recipient address, phone, and email fields
  - keep facility-specific fields such as `facility_room`
- `PARTNER_PROGRAM`
  - allow and emphasize recipient address, phone, and email fields
  - keep group/program contact info available for coordination and reporting

### Wishlist Editing

Wishlist editing should be person-centered, not group-centered.

Recommended shape:

- open from the person drawer
- show a table/list of wishlist items
- allow add/edit/remove item rows

This keeps the operational truth clear:

- wishlist belongs to the individual recipient

### UI Language

Recommended friendly labels:

- `People`
- `Households, Facilities & Programs`
- `Contacts`
- `Wishlists`

Avoid leading with colder internal phrases like:

- `Recipient Groups`
- `Recipients`

unless a lower-level admin/reporting screen needs exact domain naming.

### Recommended Intake Experiences

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

### Partner Program Intake

- create partner program group
- add program coordinator contacts
- add one or more adult recipients
- collect recipient home/contact information where available
- add wishlist per adult

This should be one domain workspace with workflow-aware forms, not three separate
products.

### Relationship To Existing Navigation

The current placeholder `Families` area should be replaced by this campaign-aware
`People` section.

Recommended direction:

- sidebar/nav parent label: `People`
- child items:
  - `Intake`
  - `Directory`
- route targets:
  - `/campaigns/:campaignId/people/intake`
  - `/campaigns/:campaignId/people/directory`
- retire the old family-only framing from the UI

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
- partner-program coordination contacts vs recipient home contacts

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
  - `SENIOR -> recipient_kind=ADULT, program_type=SENIOR_FACILITY`
  - `CHILD -> program_type=CHILD_FAMILY`
  - `ADULT -> program_type=SENIOR_FACILITY` where current data is in institution groups

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

That will support:

- children in family intake flows
- adults in nursing-home/facility flows
- adults in partner-program flows

without breaking the downstream gift pipeline into multiple incompatible models.
