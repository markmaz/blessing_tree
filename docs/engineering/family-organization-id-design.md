# Family and Organization Recipient ID Design

Date: 2026-06-08
Status: Proposed

## Problem

Some organizations contain families. Staff want the organization directory and
printed reports to show a family-level identifier, while still giving every
recipient inside that family a unique recipient identifier.

Example desired display:

| Row Type | ID | Meaning |
| --- | --- | --- |
| Family group | `BT-001` | The Alvarez Family under Blessing Tree |
| Recipient | `BT-001-01` | First child/member in that family |
| Recipient | `BT-001-02` | Second child/member in that family |
| Recipient | `BT-001-03` | Third child/member in that family |

The ID must work in directories, exports, gift search, mobile receive, sponsor
drop-off QR workflows, labels, and printed operating reports.

## Goals

- Add a durable group-level printed ID for families/households.
- Keep every recipient uniquely addressable.
- Use numeric suffixes for recipients under a family: `BT-001-01`,
  `BT-001-02`, etc.
- Preserve existing internal UUID primary keys and relationships.
- Keep searching `BT-001` useful by returning the whole family/group.
- Keep searching `BT-001-02` exact by returning only that recipient.
- Avoid breaking active campaigns that already have printed labels, sponsor
  emails, or QR workflows.

## Non-Goals

- Do not replace UUID primary keys.
- Do not require every organization itself to have a numeric group ID.
- Do not force historical campaigns to renumber automatically without an
  explicit admin action.
- Do not change sponsor QR tokens to expose raw database IDs.

## Recommended ID Model

### New Group Fields

Add these nullable columns to `recipient_group`:

| Column | Type | Purpose |
| --- | --- | --- |
| `program_group_number` | integer nullable | Campaign/program scoped sequence number for family/group IDs. |
| `program_group_id` | varchar(32) nullable | Printed family/group ID such as `BT-001`. |

Indexes and constraints:

- Unique constraint: `(campaign_id, program_group_id)`
- Index: `(campaign_id, program_group_id)`
- Keep existing `(campaign_id, program_abbreviation)` uniqueness unchanged.

### Existing Recipient Fields

Keep existing recipient fields:

- `recipient.program_recipient_number`
- `recipient.program_recipient_id`

For family recipients, `program_recipient_number` becomes the child/member
suffix number inside the family group.

### ID Format

For household/family groups nested under an organization:

- Family/group ID: `<organization_abbreviation>-<family_sequence:03d>`
- Recipient ID: `<program_group_id>-<recipient_sequence:02d>`

Example:

- Blessing Tree organization abbreviation: `BT`
- Alvarez Family group ID: `BT-001`
- Children:
  - `BT-001-01`
  - `BT-001-02`
  - `BT-001-03`

For standalone households not under an organization:

- Use the campaign's primary program abbreviation.
- Example with campaign primary abbreviation `BT`: family `BT-001`,
  recipients `BT-001-01`, `BT-001-02`.
- Do not use a generic `HH-###` prefix by default.

For organization adults, keep the existing organization-member pattern unless
the campaign later chooses to move them to the group/member pattern:

- Oakmont resident: `OAK-001`
- Azelway resident: `AZ-001`

This avoids adding fake family grouping where the operational reality is one
organization with individual residents.

## Current-State Impact

The current code already has the right structural concept:

- `recipient_group.parent_organization_group_id` supports families under an
  organization.
- `recipient_group.program_abbreviation` identifies organization abbreviations.
- `recipient.program_recipient_id` is already unique per campaign.

The missing piece is a durable group-level printed ID. Today,
`program_recipient_id` is recipient-only, and the service primarily assigns it
for organization adults as `<program_abbreviation>-###`.

## Assignment Rules

### When Creating a Family Under an Organization

1. Load the parent organization.
2. Determine the prefix:
   - Prefer parent `program_abbreviation`.
   - If missing, derive it from parent organization name and persist it.
3. Find the next `program_group_number` among family groups under that same
   parent organization and campaign.
4. Assign:
   - `program_group_number = next_number`
   - `program_group_id = <prefix>-<next_number:03d>`
5. Assign recipient IDs for children/members in that family:
   - `program_recipient_number = 1`
   - `program_recipient_id = <program_group_id>-01`

### When Adding a Recipient to a Family

1. Ensure the family has a `program_group_id`.
2. Find the next recipient suffix number in that group.
3. Assign:
   - `program_recipient_number = next_suffix`
   - `program_recipient_id = <program_group_id>-<next_suffix:02d>`

### When Moving a Family Between Organizations

Moving a family after IDs have been printed is risky.

Recommended behavior:

- If the campaign is still in setup/draft, allow recalculation after a strong
  confirmation.
- If the campaign is active, require an admin-only confirmation and show a
  warning that printed labels, sponsor emails, and operating reports may no
  longer match.
- Audit the previous and new `program_group_id` and all changed recipient IDs.

### When Deleting a Recipient

Default recommendation: do not renumber remaining recipients.

Example:

- Existing: `BT-001-01`, `BT-001-02`, `BT-001-03`
- Delete `BT-001-02`
- Keep `BT-001-01`, `BT-001-03`
- Next added child becomes `BT-001-04`

This prevents printed labels and sponsor emails from silently changing meaning.

### When Deleting a Family

Do not reuse the family number by default. If `BT-001` is deleted, the next
family should still be `BT-002` or higher. Reuse creates confusion with old
exports and audit history.

## Search Semantics

Search should understand both group IDs and recipient IDs.

| Query | Expected Result |
| --- | --- |
| `BT-001` | Family group plus all recipients/gifts under that family. |
| `BT-001-01` | Only recipient `BT-001-01` and that recipient's gifts. |
| `BT 001` | Same as `BT-001`. Normalize whitespace and case. |
| `bt-001-01` | Same as `BT-001-01`. |

Implementation notes:

- Add normalized exact matching for `recipient_group.program_group_id`.
- Keep existing exact matching for `recipient.program_recipient_id`.
- In mobile receive:
  - `BT-001-01` should receive one recipient's wishlist.
  - `BT-001` should show a family-level selection or all family recipients.

Required mobile V1 behavior for family-level lookup:

- If the user enters `BT-001`, show the family header and grouped recipient
  cards.
- Each recipient card lists that recipient's wishlist items.
- Receiving still happens at the gift item level.

## API Changes

### Recipient Group Serialization

Add to group payloads:

```json
{
  "program_group_number": 1,
  "program_group_id": "BT-001"
}
```

Affected serializers:

- `serialize_recipient_group`
- campaign people workspace group mapping
- sponsor/workflow report payloads where group context is shown

### Recipient Serialization

No new recipient fields are required, but the existing
`program_recipient_id` should contain the suffixed ID for family members.

### Receive Lookup

Extend the receive lookup endpoint to distinguish exact group and recipient
matches:

- `GET /campaigns/<campaign_id>/gifts/receive-lookup?recipient_id=BT-001`
  returns all gifts for recipients in family `BT-001`.
- `GET /campaigns/<campaign_id>/gifts/receive-lookup?recipient_id=BT-001-02`
  returns only that recipient's gifts.

The response can remain the existing gift search response shape. The frontend
can group by `recipient.id` when multiple recipients are returned.

### Search APIs

Gift search and people workspace search should include:

- `recipient_group.program_group_id`
- `recipient.program_recipient_id`

This lets one search box support both family-level and recipient-level IDs.

## UI Changes

### People Directory

Households and Organizations table:

- Add or expose group ID on the group row.
- Sort group IDs naturally:
  - `BT-001`
  - `BT-002`
  - `BT-010`
- Expanded recipient rows show recipient IDs:
  - `BT-001-01`
  - `BT-001-02`

Recommended group row display:

- Primary: `BT-001  Alvarez Family`
- Secondary: `Associated with Blessing Tree`

### Organization Directory PDF/Excel

For organizations with families:

- Organization hero/header remains organization-level.
- Family row shows:
  - family/group ID
  - parent/guardian/contact
  - total people
- Recipient sub-table shows:
  - recipient ID
  - recipient name/display label
  - age/gender/location
  - gift items
  - sponsor

This matches the report users are asking for without losing recipient-level
gift traceability.

### Gift Search

Recipient display should show both levels when available:

```text
BT-001-02
Alvarez Family · Blessing Tree
```

If the query is a group ID, results should show all recipients/gifts under that
family.

### Mobile Receive

Recipient ID prompt stays simple.

If exact recipient ID:

- Show one recipient and their wishlist.

If exact group ID:

- Show family header.
- Show recipient sections underneath.
- Each item retains the existing receive/undo behavior.
- Staff can receive specific items directly from the family lookup without
  first choosing one recipient.

### Labels and QR

Gift labels should keep printing the recipient ID, not just the family ID:

- Print `BT-001-02` on gift labels.
- Do not print the family ID as secondary text.

Sponsor drop-off email should include recipient IDs with suffixes. Sponsor QR
tokens should remain opaque and should not change format.

## Data Migration Plan

### Phase 1: Schema

Add migration:

```sql
ALTER TABLE recipient_group
  ADD COLUMN program_group_number INT NULL,
  ADD COLUMN program_group_id VARCHAR(32) NULL;

CREATE INDEX idx_recipient_group_program_group_id
  ON recipient_group (campaign_id, program_group_id);

ALTER TABLE recipient_group
  ADD CONSTRAINT uq_recipient_group_program_group_id
  UNIQUE (campaign_id, program_group_id);
```

Use the repo's migration framework and MySQL-compatible syntax.

### Phase 2: Service Assignment

Update recipient service:

- Add `_assign_program_group_identity`.
- Add `_assign_family_recipient_identity`.
- Update create/update group flows.
- Update create/update recipient flows.
- Keep existing organization adult assignment behavior.

### Phase 3: Backfill Utility

Create an admin/backfill command that can run campaign-by-campaign:

1. Find household groups in the campaign.
2. Assign stable `program_group_number` ordered by:
   - existing minimum recipient number if present
   - created date
   - group name
   - UUID
3. Assign `program_group_id`.
4. Assign recipient suffix IDs ordered by:
   - existing `program_recipient_number` if present
   - created date
   - display label
   - UUID
5. Write an audit event summary.

Do not run this automatically on production active campaigns without an explicit
admin decision.

Implemented command:

```bash
cd blessing-tree-api
python scripts/backfill_family_group_ids.py --campaign-id <campaign_uuid>
python scripts/backfill_family_group_ids.py --campaign-id <campaign_uuid> --apply
```

The default mode is a dry run. It reports how many household groups were scanned,
how many group IDs would change, and how many child recipient IDs would be
rewritten, then rolls back the transaction. The `--apply` flag is required to
persist changes.

### Phase 4: API/UI Exposure

- Add group ID to serializers and TypeScript types.
- Show group ID in People Directory, mobile group search, exports, and reports.
- Add natural sort helpers for composite IDs.

### Phase 5: Search and Mobile Receive

- Add group ID exact matching to gift search.
- Extend receive lookup for group IDs.
- Update mobile receive rendering for multi-recipient family results.

### Phase 6: Seed and Documentation

- Update seed script to generate:
  - family group IDs: `BT-001` through `BT-100`
  - child recipient IDs: `BT-001-01`, `BT-001-02`, etc.
- Update the seeded demo campaign so it uses the new group/member ID scheme.
- Update Ask Blessing Tree knowledge.
- Update user guide and screenshots after UI changes.

## Backward Compatibility

Existing campaigns may already have printed recipient IDs. Handle them with a
campaign setting or migration mode:

| Mode | Behavior |
| --- | --- |
| Legacy | Keep current IDs unchanged. New groups use the old pattern. |
| Family Group IDs | New family groups use group/member IDs. Existing records unchanged unless backfilled. |
| Backfilled | Existing family records are assigned group/member IDs by an admin-run backfill. |

Recommended default:

- New campaign years: Family Group IDs enabled automatically.
- Existing active campaigns: Legacy until an admin opts into backfill.
- Demo seed: Family Group IDs enabled immediately.

## Validation Rules

- `program_group_id` must be unique within a campaign when present.
- `program_recipient_id` remains unique within a campaign when present.
- Family recipient IDs must start with the group's `program_group_id`.
- Recipient suffix should be numeric, two digits minimum.
- Family sequence should be numeric, three digits minimum.
- IDs should be normalized to uppercase.

## Natural Sorting

String sort will put `BT-001-10` before `BT-001-02` in some contexts.

Add a shared natural sort parser:

```text
BT-001-02 -> ["BT", 1, 2]
OAK-012   -> ["OAK", 12]
```

Use it in:

- People Directory: implemented through the shared frontend comparator.
- Gift Search: use the same comparator where recipient-ID ordering is presented or exported.
- mobile result lists: implemented for family receive grouping.
- PDF/Excel exports: implemented for People Directory rows.
- seeded data generation tests

## Audit and Safety

ID changes should create audit events when they happen after creation:

- area: `people`
- entity type: `recipient_group` or `recipient`
- old/new `program_group_id`
- old/new `program_recipient_id`
- actor user
- reason: create, backfill, parent organization change, manual admin reset

Admin confirmations are required for:

- Backfilling active campaigns.
- Moving a family to a different parent organization after IDs exist.
- Regenerating IDs after labels or sponsor emails may have gone out.

## Testing Plan

Backend tests:

- Creating a family under `Blessing Tree` assigns `BT-001`.
- Creating recipients assigns `BT-001-01`, `BT-001-02`.
- Adding a later recipient does not renumber existing recipients.
- Deleting a recipient does not reuse suffixes.
- Creating a second family assigns `BT-002`.
- Moving a family requires the configured confirmation path.
- Searching `BT-001` returns all family gifts.
- Searching `BT-001-02` returns only one recipient's gifts.
- Mobile receive lookup supports both group and recipient IDs.
- Existing organization adult IDs still behave as `OAK-001`, `AZ-001`.

Frontend tests:

- People Directory displays group and recipient IDs.
- Natural sort orders `BT-001`, `BT-002`, `BT-010`.
- Gift Search displays family context under recipient details.
- Mobile receive renders grouped recipients for a family ID.
- PDF/Excel exports include family group rows and suffixed recipient IDs.

Seed tests:

- Demo campaign generates 100 Blessing Tree family group IDs.
- Children under a family use two-digit suffixes.
- No duplicate `program_group_id`.
- No duplicate `program_recipient_id`.

## Decisions

1. Standalone households use the campaign's primary program abbreviation, not
   `HH-###`.
2. Mobile receive accepts a family ID in V1 and shows all recipients and
   wishlist items in that family. Staff can receive specific items from that
   grouped view.
3. New campaign years automatically use the new group/member scheme. Existing
   active campaigns stay legacy unless explicitly backfilled.
4. Gift labels print only the suffixed recipient ID, not the family ID as
   secondary text.

## Recommendation

Implement this for new campaigns and the demo seed first. Keep production active
campaigns legacy unless an admin explicitly backfills them.

The safest first implementation slice is:

1. Add `program_group_id` and `program_group_number`.
2. Generate family IDs for new families under organizations.
3. Generate suffixed recipient IDs for recipients under those families.
4. Update directories, exports, gift search, and mobile receive lookup.
5. Update the demo seed to prove the workflow with realistic data.
