import { describe, expect, it } from 'vitest';
import { makeGift } from './giftSearchTable.testFixtures';
import { filterAndSortGiftSearchItems } from './giftSearchTable';

describe('gift search table', () => {
  it('filters availability without changing the source array', () => {
    const items = [makeGift(10), makeGift(2, false)];
    expect(filterAndSortGiftSearchItems(items, 'available', 'gift', 'asc')).toEqual([items[0]]);
    expect(filterAndSortGiftSearchItems(items, 'unavailable', 'gift', 'asc')).toEqual([items[1]]);
    expect(items.map((i) => i.wishlistItemId)).toEqual(['10', '2']);
  });
  it('sorts IDs naturally and quantities numerically in either direction', () => {
    const items = [makeGift(10), makeGift(2)];
    for (const key of ['recipientId', 'quantity', 'cost'] as const) {
      expect(filterAndSortGiftSearchItems(items, 'all', key, 'asc')[0].wishlistItemId).toBe('2');
      expect(filterAndSortGiftSearchItems(items, 'all', key, 'desc')[0].wishlistItemId).toBe('10');
    }
  });
  it('sorts genders by their displayed labels', () => {
    const unknown = makeGift(1); unknown.recipient!.gender = 'U';
    const nonbinary = makeGift(2); nonbinary.recipient!.gender = 'X';
    expect(filterAndSortGiftSearchItems([unknown, nonbinary], 'all', 'gender', 'asc')[0]).toBe(nonbinary);
  });
  it('compares month and year ages in the same unit and leaves missing values last', () => {
    const infant = makeGift(10); infant.recipient!.ageUnit = 'MONTHS';
    const child = makeGift(2); const missing = makeGift(1); missing.recipient!.age = null;
    expect(filterAndSortGiftSearchItems([child, missing, infant], 'all', 'age', 'asc').map(i => i.wishlistItemId)).toEqual(['10', '2', '1']);
    expect(filterAndSortGiftSearchItems([child, missing, infant], 'all', 'age', 'desc').map(i => i.wishlistItemId)).toEqual(['2', '10', '1']);
  });
});
