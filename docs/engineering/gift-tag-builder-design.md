# Gift Tag Builder Design

Last updated: 2026-05-27

## Status

- Phase 1 complete: template storage, default layout, API, and migration.
- Phase 2 complete: campaign manager builder UI, route/navigation, merge fields,
  image placement, reset-to-default, and required QR guardrails.
- Phase 3 complete: saved templates drive PDF export, selected gift batches print
  to letter-size sheets, and blank/manual tags create real unassigned QR labels
  that open the mobile scan page with a clear unassigned-tag message.
- Phase 4 next: sample sheets, long-text warnings, print history, and sheet
  layout test hardening.
- Builds on the gift workflow, QR scan flow, and campaign flyer builder.
- Related documents:
  - `docs/engineering/gift-workflow-design.md`
  - `docs/engineering/gift-workflow-implementation-plan.md`
  - `docs/engineering/campaign-studio-design.md`

## Purpose

Campaign managers need a simple way to define what printed gift tags look like.
Staff then print tags in batches for received, wrapped, ready, or selected
gifts. Every printed tag must include the QR code used by staff to open the
mobile scan page and update the gift workflow.

The gift tag builder should feel similar to the flyer builder, but the output
model is different:

- the editor designs one tag template
- printing/export lays many merged tags onto a letter-size PDF sheet
- the QR code is mandatory and must remain scannable

## Goals

1. Let campaign managers design campaign-specific gift tag templates.
2. Support 2x2 inch and 3x2 inch tag formats.
3. Require every template and every exported tag to include a QR code.
4. Support dynamic merge fields from recipient, campaign, and gift records.
5. Export print-ready letter-size PDFs with multiple tags per page.
6. Reuse the public/staff QR scan route already used by gift workflow labels.
7. Keep physical gift details minimal by default, so tags identify who receives
   the gift without advertising the contents.
8. Support quick blank/manual tags for gifts that staff need to label by hand.

## Non-Goals For First Release

- Vendor-specific label sheet calibration.
- Direct printer integration.
- AI image generation inside the builder.
- Multiple template variants per gift category.
- Full desktop-publishing behavior beyond simple drag, resize, rotate, and text
  editing.

## Recommended Tag Sizes

The builder should support both tag sizes, but the default should be 3 inches
wide by 2 inches tall.

### Option A: 2x2 Inch Tags

Letter sheet capacity:

- page size: 8.5 x 11 inches
- tag size: 2 x 2 inches
- practical layout: 4 columns x 5 rows
- total tags per page: 20

Pros:

- highest batch density
- easy to cut on a simple grid
- matches the "4 across" expectation

Cons:

- QR code, recipient name, family/group, age, and gender compete for space
- long recipient/family names will need aggressive truncation or small type
- less room for campaign theme imagery

Use when:

- tags are mostly QR plus recipient identity
- staff wants maximum tags per sheet
- campaign does not need decorative tags

### Option B: 3x2 Inch Tags

Letter sheet capacity when tags are 3 inches wide and 2 inches tall:

- page size: 8.5 x 11 inches
- tag size: 3 x 2 inches
- practical layout: 2 columns x 5 rows
- total tags per page: 10

Pros:

- much better QR scan reliability
- more readable recipient/family/age/gender text
- room for a small campaign-purpose image or logo
- easier to design horizontally, like a traditional gift tag

Cons:

- fewer tags per sheet
- more paper/cutting for large campaigns

Use when:

- tags need to look polished
- QR scanning will happen in busy pickup/distribution conditions
- recipient labels may have longer names or group names

### Recommendation

Use 3x2 inches as the default template size and support 2x2 inches as an
alternate campaign setting.

The QR should reserve at least 0.75 x 0.75 inches on 2x2 tags and at least
0.9 x 0.9 inches on 3x2 tags. The editor should warn if the QR is made smaller
than the minimum.

## Required Tag Content

Every exported tag must include:

- QR code linked to the gift scan page

Every tracked gift tag must include:

- recipient display name or configured public/internal label
- family, household, organization, or group name when present
- age or age band when present
- gender when present

Blank/manual tags are the exception for recipient fields. They still require a
QR code, but recipient-specific merge fields render as blank lines or empty
spaces.

Default tag content should not include:

- gift description
- internal IDs
- sponsor name
- recipient contact information
- household address

Gift description should be available as an optional merge field to users who can
edit gift tag templates, but it should not be included in the default template.

## QR Code Behavior

The QR code points to the existing scan route by `label_code`.

Expected route shape:

- `/scan/gifts/:labelCode`

The scan page already supports workflow actions such as receive, wrap, ready,
distribute, exception, and reprint. The tag builder should not create a separate
QR route unless the scan flow changes.

Rules:

- QR element is required.
- QR element cannot be deleted.
- QR element can be moved and resized within safe bounds.
- QR must be above the minimum physical size.
- Export should fail with a clear message if a saved template somehow lacks QR.

### Blank Or Manual Tags

Staff may need to print empty tags quickly and fill them out by hand for gifts
that are not yet tracked in the system. This is common for bulk donations,
last-minute gifts, or gifts brought in without a clean wishlist association.

The system should support a blank/manual print mode:

- staff requests a quantity, such as "print 10 blank tags"
- tag uses the same campaign gift tag template
- merge field values render as blank lines or empty spaces
- QR code still prints
- QR code represents an unassigned/manual label code, not a fake gift

Do not print bogus QR codes. Do not print empty QR boxes. Both create a bad scan
experience and make operations unreliable.

Recommended behavior:

- create unassigned label codes for blank tags
- QR scan opens the gift scan page in "Unassigned Tag" mode
- staff can either:
  - attach the tag to an existing wishlist item
  - create/record an ad hoc donated gift and attach it later
  - mark the tag void if it was printed by mistake

If the first implementation cannot support attachment workflows yet, the QR scan
page should still give a clear message such as "This tag is not attached to a
gift yet" and provide next-step guidance. It should not fail silently.

## Dynamic Merge Fields

The Konva template should store placeholders rather than fixed values.

Initial merge fields:

| Field | Meaning |
| --- | --- |
| `{{recipient_display_name}}` | Safe recipient display name. |
| `{{family_or_group_name}}` | Household, family, organization, or group. |
| `{{age_display}}` | Age or age band. |
| `{{gender}}` | Recipient gender label. |
| `{{campaign_name}}` | Campaign name. |
| `{{campaign_purpose}}` | Campaign purpose/theme. |
| `{{gift_tag_message}}` | Campaign-configured static tag message. |

Future optional merge fields:

| Field | Meaning |
| --- | --- |
| `{{gift_description}}` | Wishlist item description. Optional for template editors. |
| `{{program_id}}` | Recipient program/client identifier. Internal-only. |
| `{{sponsor_display_name}}` | Sponsor name. Internal-only. |

Merge fields output values only. The system should not automatically prefix
labels such as "Family:" or "Age:". Template editors can add static text labels
manually if they want them.

## Data Model

Add one active gift tag template per campaign for the first release.

Table: `campaign_gift_tag_template`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `BINARY(16)` | Primary key. |
| `campaign_id` | `BINARY(16)` | FK to `campaign`, cascade delete. |
| `template_key` | `VARCHAR(100)` | Default `default_gift_tag`. Unique per campaign. |
| `name` | `VARCHAR(255)` | User-facing template name. |
| `tag_width_in` | `DECIMAL(4,2)` | Default `3.00`. |
| `tag_height_in` | `DECIMAL(4,2)` | Default `2.00`. |
| `orientation` | `ENUM('PORTRAIT','LANDSCAPE')` | Default `LANDSCAPE`. |
| `layout_json` | `JSON` | Konva template layout. |
| `gift_tag_message` | `VARCHAR(500)` | Optional static campaign message. |
| `include_cut_lines_default` | `TINYINT(1)` | Default `1`. |
| `is_active` | `TINYINT(1)` | Default `1`. |
| `created_by_user_id` | `BINARY(16)` | Nullable FK to app user. |
| `created_at` | `DATETIME` | Standard timestamp. |
| `updated_at` | `DATETIME` | Standard timestamp. |

Constraint:

- unique `(campaign_id, template_key)`

Recommended layout JSON shape:

```json
{
  "editor": "konva",
  "design": {
    "editor": "konva",
    "version": 1,
    "unit": "in",
    "width": 3,
    "height": 2,
    "elements": [
      {
        "id": "qr",
        "type": "qr",
        "x": 1.96,
        "y": 0.86,
        "width": 0.84,
        "height": 0.84,
        "locked": false,
        "required": true
      },
      {
        "id": "...",
        "type": "text",
        "text": "{{recipient_display_name}}",
        "x": 0.12,
        "y": 0.18,
        "width": 1.72,
        "height": 0.32
      }
    ]
  }
}
```

The editor can use pixel coordinates internally, but persisted layout should
include tag physical dimensions so export can reliably map to PDF points.

## API Design

Campaign manager template APIs:

- `GET /api/v1/campaigns/:campaign_id/gift-tag-template`
- `PUT /api/v1/campaigns/:campaign_id/gift-tag-template`

Print/export APIs:

- `POST /api/v1/campaigns/:campaign_id/gifts/tags/preview`
- `POST /api/v1/campaigns/:campaign_id/gifts/tags/print-jobs`

The preview endpoint returns merged tag payloads for selected wishlist item IDs.
The print job endpoint should create or reuse label print jobs, ensure each item
has a label code, and return enough payload data for the frontend PDF renderer.
Batch printing must support both explicit selected gifts and quantity-based
requests such as "print 10 tags".
It must also support blank/manual quantity requests such as "print 10 blank
tags".

Quantity-based requests should pick the next eligible gifts using a clear,
repeatable ordering. The first release should use:

1. selected status filter from the page where print was requested, if present
2. gifts that do not already have a recent printed tag first
3. recipient name/group ordering
4. wishlist item creation date

The API response should include the actual gifts selected for printing so staff
can verify the batch before or after export.

Example print job request:

```json
{
  "wishlist_item_ids": ["..."],
  "template_id": "...",
  "include_cut_lines": true
}
```

Example quantity-based print job request:

```json
{
  "quantity": 10,
  "status_filter": "READY_FOR_DISTRIBUTION",
  "template_id": "...",
  "include_cut_lines": true
}
```

Example blank/manual print job request:

```json
{
  "quantity": 10,
  "mode": "BLANK_MANUAL",
  "template_id": "...",
  "include_cut_lines": true
}
```

Example print payload:

```json
{
  "template": {
    "tag_width_in": 3,
    "tag_height_in": 2,
    "layout_json": {}
  },
  "tags": [
    {
      "wishlist_item_id": "...",
      "label_code": "...",
      "qr_url": "https://...",
      "tag_mode": "TRACKED_GIFT",
      "merge_fields": {
        "recipient_display_name": "Ava",
        "family_or_group_name": "Martinez Family",
        "age_display": "8",
        "gender": "Girl",
        "campaign_name": "Christmas Giving 2026",
        "campaign_purpose": "Christmas Giving"
      }
    }
  ]
}
```

For blank/manual tags, `wishlist_item_id` is null, `tag_mode` is
`BLANK_MANUAL`, and merge fields are empty strings unless the template has
campaign-level fields such as campaign name or campaign purpose.

## Frontend Design

Route:

- `/campaigns/:campaignId/gifts/tag-builder`

Navigation:

- Add as a child under Gifts.
- Also link from Campaign Studio and Gift Status print flows.
- Add Ask Blessing Tree help coverage so users can ask how to design, edit,
  and print gift tags.

Primary page layout:

- left panel: template settings and saved/default template summary
- center: Konva tag editor
- right or drawer: selected element controls
- footer/action bar: save template, preview sheet, export sample PDF

Editor capabilities:

- add text placeholder
- add static text
- add image/logo
- add simple shape/background
- move/resize/rotate elements
- edit font size, weight, color, alignment
- switch template size between 2x2 and 3x2
- show safe area and cut boundaries
- lock/unlock non-QR elements
- QR is present by default and cannot be deleted
- toggle cut lines on or off for export, default on

Template size behavior:

- changing size should ask for confirmation because it can reposition elements
- initial implementation can reset to a default layout when size changes
- future implementation can scale existing elements proportionally

Print entry points:

- Gift Status selected rows
- Gift Status quantity print action, such as "Print next 10 tags"
- Gift Operations print queue
- Gift Operations quantity print action
- Gift Operations blank/manual quantity print action, such as "Print 10 blank tags"
- individual gift drawer
- Gift Tag Builder sample preview

Ask Blessing Tree prompts this feature should answer:

- "How do I create gift tags?"
- "Where do I edit gift tags?"
- "How do I print gift tags?"
- "How do I print 10 gift tags?"
- "How do I print blank gift tags?"
- "What has to be on a gift tag?"
- "Where is the Gift Tag Builder?"

## PDF Layout

Use frontend PDF generation with `jsPDF`, consistent with the flyer builder.

Letter page:

- width: 612 pt
- height: 792 pt

Physical conversion:

- 1 inch = 72 PDF points
- 2x2 tag = 144 x 144 pt
- 3x2 tag = 216 x 144 pt

Recommended default sheet layouts:

| Tag Size | Columns | Rows | Tags/Page | Notes |
| --- | ---: | ---: | ---: | --- |
| 2x2 | 4 | 5 | 20 | Uses 8 inches of width and 10 inches of height before margins/gutters. |
| 3x2 | 2 | 5 | 10 | Uses 6 inches of width and 10 inches of height before margins/gutters. |

Default margins:

- horizontal margin: 0.25 inch
- vertical margin: 0.5 inch for 2x2
- vertical margin: 0.5 inch for 3x2
- gutter: 0 inch by default, with optional cut lines

The PDF renderer should:

- render each merged tag offscreen from the Konva template
- replace QR placeholder with item-specific QR image
- replace text placeholders with item-specific values
- draw optional cut lines
- paginate automatically

Cut lines should be on by default and available as an export option. There is no
hole-punch guide in the first release.

## Default Seeded Template

Each campaign should get a default gift tag template automatically, similar to
the seeded sponsor recruitment flyer. The first load of Gift Tag Builder should
always have a usable template instead of starting from a blank canvas.

Default template settings:

- size: 3 inches wide by 2 inches tall
- orientation: landscape
- cut lines: on
- QR code: lower right, required
- logo: Blessing Tree logo
- merge fields: recipient display name, family/group, age, gender

Logo source:

- local development URL: `http://localhost:5173/blessing-tree-logo.png`
- persisted template value should use `/blessing-tree-logo.png` so it works
  across local and deployed environments

Suggested default 3x2 layout:

- small Blessing Tree logo on the left or top-left
- recipient name in large bold type
- family/group name below recipient
- age and gender on one line
- optional campaign purpose/message
- QR code in lower right
- small "Scan for workflow actions" line near QR

No gift description by default.
No default imagery beyond the Blessing Tree logo.

## Default 2x2 Template

Suggested first default layout:

- recipient name in large bold type
- family/group name in smaller type
- age and gender in compact row
- QR code centered or lower right
- no decorative image unless campaign explicitly adds one

2x2 tags should prioritize readability over decoration.

## Security And Permissions

Template management requires:

- `campaign.admin`

Printing tags requires one of:

- `campaign.gifts.check_in`
- `campaign.reports.view` from Gift Status print entry
- `campaign.admin`

Scan page security remains as currently designed. If the scan route is public or
semi-public for parking-lot usage, actions must remain constrained to the
minimal gift workflow actions allowed by label code. A staff PIN is not required
for the first release.

QR scan links should expire or become inaccessible after the campaign ends. The
scan lookup/action endpoints should reject scans for campaigns whose operational
window has ended.

## Implementation Plan

### Phase 1: Template Storage And Default Layout

1. Add `campaign_gift_tag_template` migration.
2. Add SQLAlchemy model and relationship from `Campaign`.
3. Add service with get-or-create default template.
4. Add serializers and API endpoints.
5. Add backend validation:
   - allowed sizes: 2x2 and 3x2
   - layout JSON object
   - required QR element present
   - QR minimum size
6. Seed default 3x2 template with `/blessing-tree-logo.png`, required QR, and
   standard recipient merge fields.

Exit criteria:

- each campaign can load and save one active tag template
- default 3x2 template is created automatically

### Phase 2: Tag Builder UI

1. Add route and navigation.
2. Extract shared Konva editor helpers from flyer builder where practical.
3. Build tag editor page.
4. Add merge field insertion controls.
5. Enforce non-deletable QR element.
6. Add sample merge data preview.
7. Add save/reset actions.

Exit criteria:

- campaign manager can design and save a tag template
- QR cannot be removed
- 2x2 and 3x2 template modes are supported

### Phase 3: Batch Print Payload And PDF Export

1. Add print job payload endpoint or extend existing label print job service.
2. Ensure selected wishlist items have label codes.
3. Support explicit selected gift IDs and quantity-based print requests.
4. Support blank/manual tag quantity requests with unassigned label codes.
5. Return merged tag payloads for selected gifts and blank/manual tags.
6. Implement PDF renderer:
   - 4x5 for 2x2
   - 2x5 for 3x2
   - pagination
   - cut lines
7. Wire print actions from Gift Status and Gift Operations.

Exit criteria:

- staff can select gifts and export a print-ready PDF
- staff can request a quantity such as 10 tags and export a print-ready PDF
- staff can request blank/manual tags and export a print-ready PDF
- each tag has the correct item-specific QR code
- each blank/manual tag has a non-fake unassigned QR code
- scanned QR opens the expected gift scan page

### Phase 4: Operational Polish

1. Add "print sample sheet" from builder.
2. Add warning for long text overflow.
3. Add optional campaign logo/image placement.
4. Add print history summary to gift drawer.
5. Add tests for sheet layout capacity.

Exit criteria:

- staff can confidently preview and print batches before live operations

## Test Plan

Backend:

- default template is created for campaign
- template update rejects missing QR
- template update rejects QR below minimum size
- template update rejects unsupported tag size
- print payload creates/reuses label codes
- print payload honors quantity requests
- quantity print request uses deterministic eligible-gift ordering
- blank/manual print request creates unassigned label codes
- print payload enforces campaign permissions

Frontend:

- builder loads default template
- QR cannot be deleted
- size switch updates canvas dimensions
- save sends expected payload
- sample preview renders merge fields
- batch PDF lays out 2x2 as 20 tags/page
- batch PDF lays out 3x2 as 10 tags/page
- quantity print flow exports requested count when enough eligible gifts exist
- blank/manual print flow exports requested count with blank merge fields
- cut lines default on and can be disabled
- scan links reject ended campaigns

Manual QA:

- print a 3x2 sample sheet
- print a 2x2 sample sheet
- print a quantity-based batch, such as 10 ready gifts
- print 10 blank/manual tags and scan one
- scan QR from printed paper using phone camera
- verify scan route opens quickly on mobile
- verify staff can mark picked up/distributed from scan page

## Resolved Product Decisions

1. Default tag size is 3 inches wide by 2 inches tall.
2. 2x2 inches remains an alternate size.
3. Gift description is available as an optional merge field for users with
   permission to edit gift tags.
4. Merge fields output values only. Users add any labels manually.
5. Cut lines are on by default and can be turned off.
6. No hole-punch guide in the first release.
7. No staff PIN for scan actions in the first release.
8. Scan links should expire or become inaccessible when the campaign ends.
9. No default tag imagery; users can add images themselves.
10. Vendor label stock support is not needed for the first release.
