import type { GiftSearchItem } from './giftSearchTypes';

export function makeGift(id: number, available = true): GiftSearchItem {
  return { wishlistItemId: String(id), description: `Gift ${id}`, category: null, itemType: 'GIFT',
    size: null, qtyRequested: 10, qtyFulfilled: 0, qtyRemaining: id, priority: 'MEDIUM',
    estimatedCostCents: id * 100, allowSubstitute: true, status: available ? 'OPEN' : 'COMMITTED',
    isAvailable: available, sponsorshipStatus: available ? 'UNSPONSORED' : 'SPONSORED',
    recipient: { id: String(id), displayLabel: `Child ${id}`, programRecipientId: `BT-${id}`,
      recipientKind: 'CHILD', programType: 'CHILD_FAMILY', age: id, ageUnit: 'YEARS', gender: 'F' } };
}

