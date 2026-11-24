import type { GiftSearchItem } from './giftSearchTypes';
import { compareOptionalProgramIds } from '@/shared/lib/naturalSort';

export type GiftAvailabilityFilter = 'all' | 'available' | 'unavailable';
export type GiftSearchSortKey = 'gift' | 'recipientId' | 'recipientName' | 'age' | 'gender' | 'group' | 'workflow' | 'sponsor' | 'quantity' | 'cost' | 'label';

export function filterAndSortGiftSearchItems(
  items: GiftSearchItem[], availability: GiftAvailabilityFilter,
  key: GiftSearchSortKey, direction: 'asc' | 'desc'
): GiftSearchItem[] {
  return items.filter((item) => availability === 'all' || item.isAvailable === (availability === 'available'))
    .sort((left, right) => {
      const a = sortValue(left, key);
      const b = sortValue(right, key);
      // Missing values remain last in either direction.
      if (a === null || b === null) return a === b ? compareDefault(left, right) : a === null ? 1 : -1;
      const comparison = key === 'recipientId'
        ? compareOptionalProgramIds(String(a), String(b))
        : typeof a === 'number' && typeof b === 'number' ? a - b
          : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
      return (direction === 'asc' ? comparison : -comparison) || compareDefault(left, right);
    });
}

function sortValue(item: GiftSearchItem, key: GiftSearchSortKey): string | number | null {
  switch (key) {
    case 'gift': return item.description;
    case 'recipientId': return item.recipient?.programRecipientId?.trim() || null;
    case 'recipientName': return item.recipient?.displayLabel || item.recipient?.publicLabel || null;
    case 'age': return item.recipient?.age == null ? null : item.recipient.age * (item.recipient.ageUnit === 'MONTHS' ? 1 : 12);
    case 'gender': {
      const gender = item.recipient?.gender;
      return gender ? ({ F: 'Female', M: 'Male', X: 'Nonbinary', U: 'Unknown' }[gender] ?? gender) : null;
    }
    case 'group': return item.recipient?.groupLabel || null;
    case 'workflow': return item.isAvailable ? 'Available' : item.status;
    case 'sponsor': return item.sponsor?.displayName || null;
    case 'quantity': return item.qtyRemaining;
    case 'cost': return item.estimatedCostCents;
    case 'label': return item.labelCode || null;
  }
}

function compareDefault(left: GiftSearchItem, right: GiftSearchItem): number {
  return compareOptionalProgramIds(left.recipient?.programRecipientId, right.recipient?.programRecipientId)
    || compareOptionalProgramIds(left.recipient?.groupProgramId, right.recipient?.groupProgramId)
    || left.description.localeCompare(right.description, undefined, { numeric: true, sensitivity: 'base' })
    || left.wishlistItemId.localeCompare(right.wishlistItemId);
}
