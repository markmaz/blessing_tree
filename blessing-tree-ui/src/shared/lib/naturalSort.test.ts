import { describe, expect, it } from 'vitest';

import { compareNaturalSortKeys, compareOptionalProgramIds, parseNaturalSortKey } from './naturalSort';

describe('naturalSort', () => {
  it('parses composite program IDs into comparable parts', () => {
    expect(parseNaturalSortKey('BT-001-02')).toEqual(['BT-', 1, '-', 2]);
    expect(parseNaturalSortKey('OAK-012')).toEqual(['OAK-', 12]);
  });

  it('sorts suffixed recipient IDs numerically', () => {
    const values = ['BT-001-10', 'BT-001-02', 'BT-010-01', 'BT-002-01', 'BT-001-01'];

    expect(values.sort(compareNaturalSortKeys)).toEqual([
      'BT-001-01',
      'BT-001-02',
      'BT-001-10',
      'BT-002-01',
      'BT-010-01',
    ]);
  });

  it('keeps missing program IDs after assigned IDs', () => {
    expect(['', 'BT-002', 'BT-001'].sort(compareOptionalProgramIds)).toEqual(['BT-001', 'BT-002', '']);
  });
});
