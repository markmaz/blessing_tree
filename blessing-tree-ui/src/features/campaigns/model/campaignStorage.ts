const STORAGE_PREFIX = 'blessing-tree:selected-campaign:';

function storageKey(userId: string | null): string | null {
  if (!userId) {
    return null;
  }
  return `${STORAGE_PREFIX}${userId}`;
}

export function getStoredSelectedCampaignId(userId: string | null): string | null {
  const key = storageKey(userId);
  if (!key) {
    return null;
  }
  return window.localStorage.getItem(key);
}

export function setStoredSelectedCampaignId(
  userId: string | null,
  campaignId: string | null
): void {
  const key = storageKey(userId);
  if (!key) {
    return;
  }

  if (!campaignId) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, campaignId);
}

export function clearStoredSelectedCampaignId(userId: string | null): void {
  setStoredSelectedCampaignId(userId, null);
}
