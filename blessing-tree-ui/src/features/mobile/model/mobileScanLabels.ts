import type { GiftScanAction } from '@/features/gifts/model/giftSearchTypes';

export function scanActionLabel(action: GiftScanAction): string {
  if (action === 'PICKUP') return 'Mark Picked Up';
  if (action === 'DISTRIBUTE') return 'Mark Distributed';
  if (action === 'READY') return 'Mark Ready';
  if (action === 'WRAP') return 'Mark Wrapped';
  if (action === 'RECEIVE') return 'Mark Received';
  if (action === 'REPRINT') return 'Request Reprint';
  return 'Report Exception';
}

export function scanActionIcon(action: GiftScanAction): string {
  if (action === 'PICKUP') return 'bi-person-check';
  if (action === 'DISTRIBUTE') return 'bi-truck';
  if (action === 'READY') return 'bi-check2-circle';
  if (action === 'WRAP') return 'bi-gift';
  if (action === 'RECEIVE') return 'bi-box-arrow-in-down';
  if (action === 'REPRINT') return 'bi-printer';
  return 'bi-exclamation-triangle';
}

export function scanStatusLabel(value: string): string {
  if (value === 'READY_FOR_DISTRIBUTION') return 'Ready';
  if (value === 'UNASSIGNED') return 'Unassigned';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
