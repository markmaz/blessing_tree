import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support';

test('admin can create a campaign from a previous campaign', async ({ page }) => {
  const campaignName = `E2E Campaign ${Date.now()}`;

  await loginAsAdmin(page);
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

  await page.getByLabel('Campaign Name').fill(campaignName);
  await page.getByLabel('Year').fill('2031');
  await page.getByLabel('Start From Previous Campaign').selectOption({ index: 1 });
  await page.getByLabel('Description').fill('Cloned from a previous campaign for e2e coverage.');
  await page.getByRole('button', { name: /create campaign/i }).click();

  const createdCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: campaignName }),
  });
  await expect(createdCard.getByRole('heading', { name: campaignName })).toBeVisible();
  await expect(
    createdCard.getByText(/cloned from a previous campaign for e2e coverage\./i)
  ).toBeVisible();
});
