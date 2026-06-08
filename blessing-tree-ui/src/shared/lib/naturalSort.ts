type NaturalSortPart = string | number;

export function parseNaturalSortKey(value: string | null | undefined): NaturalSortPart[] {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function compareNaturalSortKeys(left: string | null | undefined, right: string | null | undefined): number {
  const leftParts = parseNaturalSortKey(left);
  const rightParts = parseNaturalSortKey(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return rightPart === undefined ? 0 : -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (typeof leftPart === 'number' && typeof rightPart === 'number') {
      if (leftPart !== rightPart) {
        return leftPart - rightPart;
      }
      continue;
    }

    const comparison = String(leftPart).localeCompare(String(rightPart), undefined, { sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function compareOptionalProgramIds(left: string | null | undefined, right: string | null | undefined): number {
  const leftValue = left?.trim();
  const rightValue = right?.trim();
  if (!leftValue && !rightValue) {
    return 0;
  }
  if (!leftValue) {
    return 1;
  }
  if (!rightValue) {
    return -1;
  }
  return compareNaturalSortKeys(leftValue, rightValue);
}
