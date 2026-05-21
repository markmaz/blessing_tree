import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './support';

test('campaign studio can save a communications template', async ({ page }) => {
  const templateName = `E2E Template ${Date.now()}`;

  await loginAsAdmin(page);
  await page.goto('/campaigns/de90ed36-f363-42cb-9626-2179df60490c/studio');
  await page.getByRole('button', { name: /communications/i }).click();

  await expect(page.getByRole('heading', { name: 'Email Template Builder' })).toBeVisible();
  await page.getByRole('button', { name: /new template/i }).click();
  await page.getByLabel('Template Name').fill(templateName);
  await page.getByRole('button', { name: /content blocks/i }).click();
  await page.getByLabel('Subject').fill('E2E Subject');
  await page.getByRole('button', { name: /add text/i }).click();
  await page.getByLabel('Text').last().fill('Hello from Playwright.');
  await page.getByRole('button', { name: /create template/i }).click();

  await expect(page.getByText(templateName)).toBeVisible();
  await expect(page.getByText(/e2e subject/i)).toBeVisible();
});
