import { expect, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = process.env.BT_E2E_API_BASE_URL || 'http://127.0.0.1:5000';
const adminEmail = process.env.BT_E2E_ADMIN_EMAIL || 'local-admin@blessingtree.test';
const adminPassword = process.env.BT_E2E_ADMIN_PASSWORD || 'BlessingTree12345!';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username / Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/login/);
}

export async function getAdminAccessToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: { email: adminEmail, password: adminPassword },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return String(payload.access_token);
}

export async function createInvite(request: APIRequestContext, email: string, displayName: string) {
  const accessToken = await getAdminAccessToken(request);
  const response = await request.post(`${apiBaseUrl}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      email,
      display_name: displayName,
      role: 'COORDINATOR',
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.invitation.invite_url as string;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@blessingtree.test`;
}
