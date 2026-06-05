# Mobile Operator Mode Design

Last updated: 2026-06-05

## Status

Planned. No implementation has been started.

## Purpose

Blessing Tree needs a stripped-down phone experience for staff and volunteers
working away from a laptop during gift intake, sponsor lookup, and distribution
support.

This is not a responsive version of the full admin application. It is a
separate mobile operator mode focused on fast search and a narrow gift-receive
workflow.

## Product Goals

- Give phone users fast access to Gift Search, Sponsor Search, and
  Organization/Household Search.
- Let phone users receive gifts by recipient ID without opening the full
  desktop workflow.
- Preserve Blessing Tree visual identity and styling while using simpler mobile
  layouts.
- Keep the mobile experience campaign-scoped to the selected campaign.
- Avoid exposing full administrative navigation, reporting, intake, and setup
  tools on phones.
- Keep the design open for a later scanner-style recipient ID shortcut.

## Non-Goals

- No full Campaign Studio, Admin, Reports, People Intake, Sponsor Intake, or
  desktop dashboard on mobile.
- No editing sponsor details from mobile.
- No editing organization/household details from mobile.
- No undo for received gifts on mobile.
- No rewrite of official wishlist descriptions when the received item differs
  from the requested item.
- No tablet-first redesign. Tablets, laptops, and Chromebooks should continue
  using the full application unless a future requirement says otherwise.

## Routing And Entry

Add a separate mobile route namespace:

- `/mobile`
- `/mobile/gifts`
- `/mobile/receive`
- `/mobile/sponsors`
- `/mobile/groups`

Phone users who visit protected full-app routes should be redirected to
`/mobile` unless they have selected a "Full site" escape hatch.

The escape hatch should:

- be visible in the mobile top bar
- store a local browser preference
- stop automatic phone redirection for that browser
- allow users to return to mobile mode through `/mobile`

Phone detection should consider more than viewport width. Use a conservative
combination of:

- mobile user agent
- coarse pointer/touch support
- narrow viewport

Do not redirect desktop browsers, laptops, Chromebooks, or typical tablets into
mobile mode solely because the browser window is narrow.

## Mobile Shell

Implement a separate lightweight shell instead of hiding the normal desktop
sidebar/header with CSS.

The shell should include:

- a compact top bar with Blessing Tree styling
- current campaign name
- "Full site" action
- bottom tab navigation

Bottom tabs:

- Gifts
- Receive
- Sponsors
- Groups

The shell should retain the Blessing Tree look and feel:

- existing brand colors
- existing type scale adjusted for phone readability
- restrained card surfaces
- familiar icons from the app's icon set
- no generic unbranded mobile template styling

## Permissions

Use existing authentication and authorization.

- Mobile Gift Search requires existing Gifts view permission.
- Mobile commit/release/receive actions require the same gift-operation
  permissions used by desktop flows.
- Mobile Sponsor Search requires existing Sponsors view permission.
- Mobile Group Search requires existing People Directory or equivalent view
  permission.
- Results must remain scoped to the selected campaign.

If a user lacks permission for a tab, hide or disable the tab and show a short
permission-aware empty state if they deep-link into it.

## Campaign Scope

Mobile searches and actions apply only to the selected campaign.

The first implementation can use the current campaign context. Campaign
switching may remain in the full site unless the existing campaign switcher can
be safely simplified for the mobile shell.

## Mobile Receive Flow

The Receive tab is the primary operational workflow.

### User Flow

1. User enters a recipient ID such as `BT-001`.
2. The app searches the selected campaign for that recipient.
3. The app shows a compact recipient header.
4. The app shows wishlist items as checklist-style rows.
5. User taps Receive for an item.
6. If needed, user can add a receive note.
7. The item changes to received and becomes disabled in mobile.

### Recipient Header

Show:

- recipient ID
- recipient name
- age
- gender
- family or organization
- program abbreviation when available

### Wishlist Rows

Show:

- requested gift description
- size/details if present
- sponsor name if committed
- current status
- receive action when not already received

Rules:

- Any wishlist item can be received, committed or uncommitted.
- Already received items show as received and are disabled.
- Undo requires the full application.
- Receive note is optional.
- If the sponsor bought a different item than requested, capture that as a
  note-only field for V1.
- The note must not mutate the official wishlist item description in V1.

### Scanner-Ready Shape

Keep the recipient ID lookup separated enough that a later scanner shortcut can
populate the same input and trigger the same lookup. Do not couple the receive
flow to manual keyboard entry only.

## Mobile Gift Search

Gift Search should support fast lookup by:

- recipient ID
- recipient name
- gift text
- sponsor name
- family or organization name
- broad semantic gift queries when Qdrant indexing is available

Result cards should show:

- gift description
- size/details if present
- recipient ID
- recipient name
- age and gender
- family or organization
- sponsor if committed
- current gift status

Actions:

- view gift details
- view recipient details
- view sponsor details when committed
- commit gift
- release gift
- receive gift

Commit should use the desktop sponsor-search pattern:

- search bar only
- selecting a sponsor displays a clear selected sponsor row below the search
- selected sponsor can be cleared
- Commit is explicit

Release should use a mobile-friendly confirmation modal:

- show sponsor name
- show gift description
- explain that release makes the gift available again
- cancel and confirm actions

Receive from a gift result should follow the same receive rules as the Receive
tab, including optional note-only received-as-different context.

## Mobile Sponsor Search

Sponsor Search is read-only.

Search by:

- sponsor name
- phone
- email

Sponsor cards should show:

- sponsor name
- phone
- email
- commitment count
- basic follow-up/contact context if available

Sponsor detail should show:

- contact information
- committed gifts
- recipient IDs
- recipient names
- gift statuses
- received state

No sponsor profile editing is allowed in mobile V1.

## Mobile Organization And Household Search

Group Search is read-only.

Search by:

- organization or household name
- primary contact
- program abbreviation
- recipient ID

Group cards should show:

- group name
- group type
- program abbreviation
- primary contact
- people count

Group detail should show:

- group contact information
- recipients
- recipient IDs
- wishlist items
- sponsors
- gift statuses

Use compact expandable sections so families and organizations with many
recipients remain usable on a phone.

## API Expectations

Prefer reusing existing campaign-scoped APIs where they already return enough
detail. Add mobile-specific endpoints only when the desktop endpoint shape would
force excessive client-side fetching or fragile joins.

Likely API needs:

- recipient lookup by campaign and recipient ID
- wishlist items for recipient with sponsor/status details
- receive wishlist item with optional note
- gift search result shape suitable for mobile cards
- sponsor search with committed gift summaries
- group search with recipient/gift summaries

All write actions must:

- enforce existing campaign permissions
- create the same audit/activity records as desktop equivalents
- preserve existing gift workflow rules
- return updated item state for immediate UI refresh

## UX Rules

- One primary search input per tab.
- Keep result cards compact and scannable.
- Use large enough touch targets for field use.
- Keep modals/drawers full-width or near full-width on phones.
- Avoid table layouts in mobile mode.
- Avoid print/export controls in mobile mode.
- Keep empty/error states short and action-oriented.
- Never hide critical status behind hover-only interactions.
- Text must fit within cards and buttons on small phones.

## Styling Requirements

The mobile shell must look like Blessing Tree:

- retain the campaign/theme visual language
- use the existing brand color palette
- use the same icon library as the desktop app
- preserve the warm, polished Blessing Tree tone
- simplify density for phones without switching to a generic utilitarian style

Do not introduce unrelated mobile design systems or a new color palette.

## Testing Expectations

Frontend automated checks:

- mobile routes render for authenticated users
- tab navigation works
- full-site preference suppresses auto-redirect
- permission-gated tabs behave correctly
- receive flow disables already received items
- commit and release modals call the expected APIs

Backend automated checks:

- recipient ID lookup is campaign-scoped
- receive endpoint allows committed and uncommitted wishlist items
- receive endpoint rejects unauthorized users
- receive endpoint rejects cross-campaign item access
- receive endpoint records optional note without changing gift description
- release and commit reuse existing authorization/workflow behavior

Manual browser checks:

- phone viewport redirects protected app routes to `/mobile`
- desktop and Chromebook-sized viewports stay in the full app
- "Full site" escape hatch works and persists
- Gift, Sponsor, and Group searches are usable on a small phone viewport
- Receive by recipient ID is usable with one hand
- Blessing Tree styling is retained

## Implementation Plan

1. Add mobile route namespace and lightweight shell.
2. Add phone redirect guard plus full-site preference.
3. Implement Mobile Receive with recipient ID lookup and receive action.
4. Implement Mobile Gift Search with detail cards and commit/release/receive.
5. Implement Mobile Sponsor Search with read-only sponsor detail.
6. Implement Mobile Group Search with expandable recipient/gift summaries.
7. Add focused backend endpoints only where existing APIs are too heavy or
   incomplete.
8. Add tests for routing, permission checks, and receive behavior.
9. Verify with phone and desktop browser viewports before release.

## Future Enhancements

- Scanner shortcut for recipient IDs or QR codes.
- Desktop "Receive by Recipient ID" page using the same backend flow.
- Mobile campaign switcher if field users need to move between campaigns.
- Optional "received as different item" review queue in the full app.
- Offline-tolerant lookup or queueing if event venues have poor connectivity.
