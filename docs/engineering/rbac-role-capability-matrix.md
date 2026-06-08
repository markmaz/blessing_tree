# RBAC Role Capability Matrix

Last updated: 2026-06-05

## Capability Rules

Campaign access is enforced by campaign-scoped capabilities. UI controls should
be hidden when the active user lacks the capability, and API endpoints must
still reject unauthorized requests.

| Capability | User-Facing Meaning | Primary UI Surfaces | API Enforcement |
| --- | --- | --- | --- |
| `campaign.view` | View basic campaign context | Dashboard, campaign overview, Ask Blessing Tree context | Campaign read endpoints |
| `campaign.admin` | Manage campaign setup and destructive campaign operations | Campaign Studio settings, team setup, schedule setup, gift policy, flyer/tag builder, campaign delete | Campaign/studio/team/settings mutation endpoints |
| `campaign.recipients.view` | View households, organizations, recipients, and wishlists | People Directory, mobile group search | Recipient/group read endpoints |
| `campaign.recipients.edit` | Create and update recipient groups, recipients, contacts, and wishlists | People Intake, People Directory drawers | Recipient/group/wishlist mutation endpoints |
| `campaign.sponsors.view` | View sponsors and sponsor participation | Sponsor Directory, sponsor drawer, mobile sponsor search | Sponsor read endpoints |
| `campaign.sponsors.manage` | Create/update sponsors, sponsor participation, pending signups, and manual interaction logs | Sponsor Intake, Sponsor Directory edit actions | Sponsor mutation endpoints |
| `campaign.communications.send` | Preview/send campaign and sponsor email communications | Campaign Studio Send Now/Test Email, sponsor drawer Send Sponsor Email | Communication send/test/preview endpoints |
| `campaign.gifts.search` | Search and inspect gift requests | Gift Search, mobile gift search | Gift search endpoints |
| `campaign.gifts.commit` | Commit or release gifts for sponsors | Gift Search commit/release, sponsor drawer gift commit, mobile gift commit/release | Gift commit/release endpoints |
| `campaign.gifts.check_in` | Receive/unreceive gifts and resolve sponsor drop-off QR lists | Gift Operations receive actions, mobile Receive, mobile QR drop-off | Gift receive/unreceive and mobile drop-off endpoints |
| `campaign.gifts.wrap` | Mark gifts wrapped/tagged/ready where applicable | Gift Operations workflow | Gift wrap/tag/ready endpoints |
| `campaign.gifts.distribute` | Mark gifts distributed or picked up | Gift Operations workflow | Gift distribution endpoints |
| `campaign.gifts.pool.manage` | Manage donated gift inventory/pool | Gift Pool | Gift pool endpoints |
| `campaign.reports.view` | View and export campaign reports | People/Sponsor/Gift reports, report exports, Activity-style campaign reports | Report endpoints |

## Role Mapping

| Role | Intended Users | Capabilities |
| --- | --- | --- |
| App/System Admin | Product owner or technical administrator | Global app-admin rights plus all campaign capabilities |
| Campaign Manager | Campaign leads who operate the whole campaign | All campaign capabilities |
| Campaign Overview | Staff who only need campaign context | `campaign.view` |
| Campaign Studio | Campaign setup staff | `campaign.view`, `campaign.admin` |
| People Intake | Recipient intake workers | `campaign.view`, `campaign.recipients.view`, `campaign.recipients.edit`, `campaign.pickups.manage` |
| People Directory | Recipient lookup workers | `campaign.view`, `campaign.recipients.view` |
| People Reports | People/report viewers | `campaign.view`, `campaign.reports.view` |
| Sponsor Intake | Sponsor intake and sponsor communication workers | `campaign.view`, `campaign.sponsors.view`, `campaign.sponsors.manage`, `campaign.gifts.search`, `campaign.gifts.commit`, `campaign.communications.send` |
| Sponsor Directory | Sponsor lookup workers | `campaign.view`, `campaign.sponsors.view` |
| Sponsor Reports | Sponsor/report viewers | `campaign.view`, `campaign.reports.view` |
| Gift Search | Staff matching sponsors to gifts | `campaign.view`, `campaign.gifts.search`, `campaign.gifts.commit` |
| Gift Operations | Event-day gift workers | `campaign.view`, `campaign.gifts.search`, `campaign.gifts.commit`, `campaign.gifts.check_in`, `campaign.gifts.wrap`, `campaign.gifts.distribute` |
| Gift Pool | Donation inventory workers | `campaign.view`, `campaign.donations.view`, `campaign.donations.edit`, `campaign.gifts.pool.manage` |
| Gift Status | Gift status/report viewers | `campaign.view`, `campaign.reports.view` |
| Gift Tag Builder | Campaign setup staff managing tag templates | `campaign.view`, `campaign.admin` |
| Reports Only | Read-only report users | `campaign.view`, `campaign.reports.view` |
| View Only | Minimal campaign viewers | `campaign.view` |

## UI Visibility Standards

- Do not show primary mutation buttons to users missing the matching capability.
- Read-only users may see data tables, history, and details drawers, but not
  create, edit, send, delete, commit, release, receive, or revoke actions.
- Export actions are appropriate on report surfaces for users with
  `campaign.reports.view`. Search-result exports may be shown when the user has
  the capability required to view that search surface.
- Mobile Receive and sponsor drop-off QR workflows require
  `campaign.gifts.check_in`, not just generic gift search or wrap/distribute
  access.
- Gift Operations and Gift Status report actions are filtered per workflow
  capability: receive/unreceive/print tags require `campaign.gifts.check_in`,
  wrap/ready require `campaign.gifts.wrap`, and pickup/exception require
  `campaign.gifts.distribute`.
- Sponsor email send/preview/test actions require
  `campaign.communications.send`; this avoids giving sponsor-intake workers full
  campaign-admin access just to send sponsor communications.
