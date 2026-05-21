import { expect, test } from '@playwright/test';
import { createInvite, uniqueEmail } from './support';

test('invited user can accept onboarding with a local password', async ({ page, request }) => {
  const inviteUrl = await createInvite(request, uniqueEmail('e2e-invite'), 'E2E Invite User');

  await page.goto(inviteUrl);
  await expect(page.getByRole('heading', { name: 'Accept Invitation' })).toBeVisible();
  await page.getByLabel('Password').fill('BlessingTree12345!');
  await page.getByRole('button', { name: /set password & continue/i }).click();

  await expect(page.getByText(/invitation accepted\. you can sign in now\./i)).toBeVisible();
  await expect(page).toHaveURL(/login/);
});
