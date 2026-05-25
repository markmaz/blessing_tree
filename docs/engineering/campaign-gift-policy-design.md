# Campaign Gift Policy Design

## Purpose

Campaign gift policy defines campaign-manager controlled operating rules for wishlists, sponsor commitments, and recipient coverage. These are not readiness rules. Readiness says whether a campaign has missing setup; gift policy says how the campaign should behave once staff, sponsors, and recipients use the workflow.

The policy must be enforced by backend write paths. Frontend controls should guide users, but the database/API remains authoritative.

## Initial Policy Fields

Each campaign has one `campaign_gift_policy` row.

| Field | Default | Meaning |
| --- | ---: | --- |
| `max_gifts_per_sponsor` | `3` | Maximum wishlist gifts a sponsor can commit to in this campaign. Applies to public signup and staff commit actions. |
| `max_wishlist_items_per_recipient` | `3` | Maximum wishlist items allowed for one recipient. Applies when creating wishlist items. |
| `recipient_coverage_rule` | `ALL_GIFTS_SPONSORED` | How the campaign decides whether a recipient has enough sponsored gifts. |
| `recipient_coverage_required_count` | `1` | Used only when the rule is `MIN_GIFTS_SPONSORED`. |
| `allow_partial_sponsor_commitments` | `false` | Reserved for future quantity-level sponsorship. Current workflow remains whole-item sponsorship. |
| `reservation_hold_minutes` | `1440` | How long public signup gift reservations are held while email verification is pending. |

Coverage rule values:

- `ONE_GIFT_SPONSORED`: at least one gift in the recipient wishlist is sponsored.
- `MIN_GIFTS_SPONSORED`: at least `recipient_coverage_required_count` gifts are sponsored.
- `ALL_GIFTS_SPONSORED`: every wishlist item must be sponsored.

Use “coverage” in code and UI rather than “fulfilled” for this rule. The gift workflow already uses fulfillment/received/distributed statuses for physical gift handling.

## Enforcement Points

Backend enforcement is required in:

- Public sponsor signup selection validation.
- Staff gift commit endpoint.
- Wishlist item creation.
- Any future bulk import or AI-generated wishlist creation.

Frontend enforcement is advisory:

- Campaign Studio shows and edits the policy.
- Wishlist editors can show limits and disable add actions in a later phase.
- Sponsor search/signup can show the selected gift limit.

## Reporting Semantics

Reports distinguish:

- Unsponsored gift items: individual wishlist items still available or held.
- Recipient coverage: whether a recipient satisfies the campaign coverage rule.
- Physical gift workflow completion: received, wrapped, ready, distributed, or picked up.

The “People Still Needing Gifts” report is driven by recipient coverage, not merely by unsponsored item count.

## API Shape

Campaign Studio payload includes:

```json
{
  "gift_policy": {
    "campaign_id": "...",
    "max_gifts_per_sponsor": 3,
    "max_wishlist_items_per_recipient": 3,
    "recipient_coverage_rule": "ALL_GIFTS_SPONSORED",
    "recipient_coverage_required_count": 1,
    "allow_partial_sponsor_commitments": false,
    "reservation_hold_minutes": 1440,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

Managers update policy with:

`PATCH /api/v1/campaigns/:campaign_id/gift-policy`

## Implementation Plan

1. Add `campaign_gift_policy` migration and SQLAlchemy model.
2. Add `CampaignGiftPolicyService` with get-or-create defaults and update validation.
3. Include policy in Campaign Studio payload and add update API.
4. Add Campaign Studio “Gift Rules” UI section.
5. Enforce sponsor gift limits in public signup and staff commit.
6. Enforce wishlist item limits when creating wishlist items.
7. Update recipient coverage reporting so “still needing gifts” means “does not satisfy recipient coverage policy.”
