import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers';

test.describe.configure({ mode: 'serial' });

const DESCRIPTION = 'E2E: the living room radiator is leaking';
let requestPath = '';

test('tenant sees rent and submits a maintenance request', async ({ page }) => {
  await signIn(page, 'tenant@sunrise.test');
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

test('manager triages, assigns, and resolves the request', async ({ page }) => {
  await signIn(page, 'manager@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/maintenance');
  await page.getByRole('link', { name: DESCRIPTION }).click();
  await expect(page.getByText(DESCRIPTION)).toBeVisible();

  const triage = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Triage', exact: true }) });
  await triage.getByLabel('Priority').selectOption('URGENT');
  await triage.getByLabel('Triage note').fill('Send staff with a replacement valve.');
  await triage.getByRole('button', { name: 'Save triage' }).click();
  await expect(page.getByText('Priority updated.')).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();

  const createWorkOrder = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create a work order', exact: true }) });
  await createWorkOrder.getByLabel('Assign to').selectOption({ label: 'Sam Staff · staff' });
  await createWorkOrder
    .getByLabel('Scheduled date')
    .fill(new Date().toISOString().slice(0, 10));
  await createWorkOrder.getByRole('button', { name: 'Create and assign' }).click();

  await expect(page.getByText('Work order assigned.')).toBeVisible();
  await expect(page.getByText('Sam Staff', { exact: true }).first()).toBeVisible();

  const workOrder = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Work order', exact: true }) });
  await workOrder.getByLabel('Update status').selectOption('IN_PROGRESS');
  await workOrder.getByLabel('Note').fill('Parts collected, starting work.');
  await workOrder.getByRole('button', { name: 'Update work order' }).click();
  await expect(page.getByText('Work order updated.')).toBeVisible();
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible();

  await workOrder.getByLabel('Update status').selectOption('RESOLVED');
  await workOrder.getByLabel('Note').fill('Valve replaced and radiator bled.');
  await workOrder.getByRole('button', { name: 'Update work order' }).click();
  await expect(page.getByText('Work order updated.')).toBeVisible();
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
});

test('staff sees assigned work and no money controls', async ({ page }) => {
  await signIn(page, 'staff@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/maintenance');
  await expect(page.getByRole('link', { name: DESCRIPTION })).toBeVisible();

  await page.goto('/rent');
  await expect(page.getByRole('button', { name: /Generate for/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Record payment' })).toHaveCount(0);
});

test('tenant sees the updated status and cannot change it', async ({ page }) => {
  await signIn(page, 'tenant@sunrise.test');
  await page.waitForURL('**/portal');

  await page.goto(requestPath);
  await expect(page.getByText(DESCRIPTION)).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Valve replaced and radiator bled.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Update|Resolve|Assign/ })).toHaveCount(0);

  await signOut(page);
});
