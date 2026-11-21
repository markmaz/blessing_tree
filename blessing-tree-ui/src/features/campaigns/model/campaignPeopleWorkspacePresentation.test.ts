import { describe, expect, it } from 'vitest';
import { formatRecipientDirectoryDetails } from './campaignPeopleWorkspacePresentation';

describe('directory member details', () => {
  it.each([
    [8, 'YEARS', 'F', null, '8, Female'],
    [12, 'YEARS', 'M', null, '12, Male'],
    [8, 'YEARS', null, null, '8'],
    [8, 'YEARS', '', null, '8'],
    [8, 'YEARS', '  ', null, '8'],
    [0, 'YEARS', 'F', null, '0, Female'],
    [1, 'MONTHS', 'M', null, '1 month, Male'],
    [8, 'MONTHS', 'F', null, '8 months, Female'],
    [8, null, 'F', null, '8, Female'],
    [null, null, 'F', null, 'Female'],
    [null, null, null, null, 'No extra details'],
    [8, 'YEARS', 'X', '12', '8, Nonbinary · Room 12'],
    [8, 'YEARS', 'U', null, '8, Unknown'],
    [8, 'YEARS', 'Female', null, '8, Female'],
    [null, null, null, '12', 'Room 12'],
  ] as const)('formats age=%s unit=%s gender=%s room=%s', (age, ageUnit, gender, facilityRoom, expected) => {
    expect(formatRecipientDirectoryDetails({ age, ageUnit, gender, facilityRoom })).toBe(expected);
  });
});
