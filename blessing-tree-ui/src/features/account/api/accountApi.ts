import { apiFetchJson } from '@/shared/api/client';
import type { AccountProfile, AccountSettings } from '@/features/account/model/accountTypes';

function normalizeProfile(profile: AccountProfile): AccountProfile {
  return {
    ...profile,
    displayName: profile.displayName ?? (profile as unknown as { display_name?: string }).display_name ?? '',
    isActive: profile.isActive ?? Boolean((profile as unknown as { is_active?: boolean }).is_active),
    lastLoginAt:
      profile.lastLoginAt ?? (profile as unknown as { last_login_at?: string | null }).last_login_at ?? null,
    createdAt: profile.createdAt ?? (profile as unknown as { created_at?: string }).created_at ?? '',
    updatedAt: profile.updatedAt ?? (profile as unknown as { updated_at?: string }).updated_at ?? '',
  };
}

function normalizeSettings(settings: AccountSettings): AccountSettings {
  return {
    timezone: settings.timezone,
    dateFormat:
      settings.dateFormat ??
      (settings as unknown as { date_format?: AccountSettings['dateFormat'] }).date_format ??
      'MM_DD_YYYY',
    defaultLandingPage:
      settings.defaultLandingPage ??
      (settings as unknown as { default_landing_page?: AccountSettings['defaultLandingPage'] }).default_landing_page ??
      'DASHBOARD',
    emailNotificationsEnabled:
      settings.emailNotificationsEnabled ??
      Boolean((settings as unknown as { email_notifications_enabled?: boolean }).email_notifications_enabled),
    createdAt: settings.createdAt ?? (settings as unknown as { created_at?: string }).created_at ?? '',
    updatedAt: settings.updatedAt ?? (settings as unknown as { updated_at?: string }).updated_at ?? '',
  };
}

export async function fetchAccountProfile(): Promise<AccountProfile> {
  const payload = await apiFetchJson<{ profile: AccountProfile }>('/api/v1/account/profile');
  return normalizeProfile(payload.profile);
}

export async function updateAccountProfile(input: { displayName: string }): Promise<AccountProfile> {
  const payload = await apiFetchJson<{ profile: AccountProfile }>('/api/v1/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: input.displayName }),
  });
  return normalizeProfile(payload.profile);
}

export async function changeAccountPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await apiFetchJson<{ status: string }>('/api/v1/account/profile/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: input.currentPassword,
      new_password: input.newPassword,
      confirm_password: input.confirmPassword,
    }),
  });
}

export async function fetchAccountSettings(): Promise<AccountSettings> {
  const payload = await apiFetchJson<{ settings: AccountSettings }>('/api/v1/account/settings');
  return normalizeSettings(payload.settings);
}

export async function updateAccountSettings(input: AccountSettings): Promise<AccountSettings> {
  const payload = await apiFetchJson<{ settings: AccountSettings }>('/api/v1/account/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: input.timezone,
      date_format: input.dateFormat,
      default_landing_page: input.defaultLandingPage,
      email_notifications_enabled: input.emailNotificationsEnabled,
    }),
  });
  return normalizeSettings(payload.settings);
}
