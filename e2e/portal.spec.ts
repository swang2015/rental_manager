import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers';

test.describe.configure({ mode: 'serial' });

const DESCRIPTION = 'E2E: the living room radiator is leaking';
const VENDOR = 'Vic Vendor · Vic Plumbing Co.';
let requestPath = '';

test('tenant sees rent and submits a maintenance request', async ({ page }) => {
  await signIn(page, 'tenant@rental.test');
  await page.waitForURL('**/portal');

  await page.goto('/portal/rent');
  await expect(page.getByRole('heading', { name: 'Your rent' })).toBeVisible();
  await expect(page.getByText('Charges', { exact: true })).toBeVisible();
  await expect(page.getByText('Outstanding', { exact: true })).toBeVisible();

  await page.goto('/portal/maintenance');
  await page.getByLabel('Category').selectOption('Plumbing');
  await page.getByLabel('What is wrong?').fill(DESCRIPTION);
  await page.getByRole('button', { name: 'Submit request' }).click();

  await page.waitForURL(/\/portal\/maintenance\/[a-z0-9]+/);
  requestPath = new URL(page.url()).pathname;
  await expect(page.getByText('Request submitted.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plumbing request' })).toBeVisible();
  await expect(page.getByText(DESCRIPTION)).toBeVisible();
});

test('owner triages and assigns the request to a vendor', async ({ page }) => {
  await signIn(page, 'owner@rental.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/maintenance');
  await page.getByRole('link', { name: DESCRIPTION }).click();
  await expect(page.getByText(DESCRIPTION)).toBeVisible();

  const triage = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Triage', exact: true }) });
  await triage.getByLabel('Priority').selectOption('URGENT');
  await triage.getByLabel('Triage note').fill('Tenant is home after 6pm.');
  await triage.getByRole('button', { name: 'Save triage' }).click();
  await expect(page.getByText('Priority updated.')).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();

  const createWorkOrder = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create a work order', exact: true }) });
  await createWorkOrder.getByLabel('Assign to').selectOption({ label: VENDOR });
  await createWorkOrder.getByLabel('Scheduled date').fill(new Date().toISOString().slice(0, 10));
  await createWorkOrder.getByRole('button', { name: 'Create and assign' }).click();

  await expect(page.getByText('Work order assigned.')).toBeVisible();
  await expect(page.getByText('Vic Vendor', { exact: true }).first()).toBeVisible();
});

test('vendor sees the assigned work order and updates progress', async ({ page }) => {
  await signIn(page, 'vendor@rental.test');
  await page.waitForURL('**/vendor');

  await page.getByRole('link', { name: /living room radiator is leaking/ }).click();
  await expect(page.getByText(DESCRIPTION)).toBeVisible();

  await page.getByLabel('New status').selectOption('IN_PROGRESS');
  await page.getByLabel('Note').fill('On my way with a replacement valve.');
  await page.getByRole('button', { name: 'Update work order' }).click();
  await expect(page.getByText('Work order updated.')).toBeVisible();

  await page.getByLabel('New status').selectOption('RESOLVED');
  await page.getByLabel('Note').fill('Valve replaced and radiator bled.');
  await page.getByRole('button', { name: 'Update work order' }).click();
  await expect(page.getByText('Work order updated.')).toBeVisible();
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();

  await signOut(page);
});

test('tenant sees the updated status and cannot change it', async ({ page }) => {
  await signIn(page, 'tenant@rental.test');
  await page.waitForURL('**/portal');

  await page.goto(requestPath);
  await expect(page.getByText(DESCRIPTION)).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Valve replaced and radiator bled.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Update|Resolve|Assign/ })).toHaveCount(0);

  await signOut(page);
});
