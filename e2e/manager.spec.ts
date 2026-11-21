import { expect, test } from '@playwright/test';
import { selectByText, signIn } from './helpers';

test.describe.configure({ mode: 'serial' });

const PROPERTY = 'E2E Court';
const UNIT_LABEL = '1';
const TENANT = 'E2E Tenant';
const TENANT_EMAIL = 'e2e.tenant@sunrise.test';
const RENT = '1000.00';

const now = new Date();
const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const startDate = `${thisMonth}-01`;
const endDate = `${now.getUTCFullYear() + 1}-12-31`;

test('manager adds a property and a unit', async ({ page }) => {
  await signIn(page, 'manager@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/properties');
  await page.getByLabel('Property name').fill(PROPERTY);
  await page.getByLabel('Street address').fill('1 Test Way');
  await page.getByLabel('City').fill('Shanghai');
  await page.getByLabel('Region / state').fill('Shanghai');
  await page.getByLabel('Postal code').fill('200000');
  await page.getByRole('button', { name: 'Add property' }).click();

  await expect(page.getByText('Property created.')).toBeVisible();
  await page.getByRole('link', { name: PROPERTY, exact: true }).click();

  await page.getByLabel('Label').fill(UNIT_LABEL);
  await page.getByLabel('Bedrooms').fill('2');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Monthly rent').fill(RENT);
  await page.getByRole('button', { name: 'Add unit' }).click();

  await expect(page.getByText('Unit added.')).toBeVisible();
  await expect(page.getByRole('heading', { name: `${PROPERTY}` })).toBeVisible();
  await expect(page.getByText('Available').first()).toBeVisible();
});

test('manager adds a tenant', async ({ page }) => {
  await signIn(page, 'manager@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/tenants');
  await page.getByLabel('Full name').fill(TENANT);
  await page.getByLabel('Email').fill(TENANT_EMAIL);
  await page.getByLabel('Phone').fill('+86 139 0000 0000');
  await page.getByRole('button', { name: 'Add tenant' }).click();

  await expect(page.getByText('Tenant created.')).toBeVisible();
  await expect(page.getByRole('link', { name: TENANT, exact: true })).toBeVisible();
});

test('manager creates, activates, and bills a lease', async ({ page }) => {
  await signIn(page, 'manager@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/leases');
  await selectByText(page, 'Unit', `${PROPERTY} · ${UNIT_LABEL}`);
  await selectByText(page, 'Tenant', TENANT);
  await page.getByLabel('Monthly rent').fill(RENT);
  await page.getByLabel('Security deposit').fill(RENT);
  await page.getByLabel('Start date').fill(startDate);
  await page.getByLabel('End date').fill(endDate);
  await page.getByRole('button', { name: 'Create draft' }).click();

  await page.waitForURL(/\/leases\/[a-z0-9]+/);
  await expect(page.getByText('Draft lease created.')).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Activate lease' }).click();
  await expect(page.getByText('Lease activated and unit occupied.')).toBeVisible();

  await page.goto(`/rent?month=${thisMonth}`);
  await page.getByRole('button', { name: `Generate for ${thisMonth}` }).click();
  await expect(page.getByText(/Charge generation finished:/)).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(TENANT) });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: TENANT }).click();

  await expect(page.getByRole('heading', { name: `Charge · ${TENANT}` })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment' }).click();

  await expect(page.getByText('Payment recorded.')).toBeVisible();
  await expect(page.getByText('This charge is fully paid. No balance remains.')).toBeVisible();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
});

test('manager sees the new unit as occupied', async ({ page }) => {
  await signIn(page, 'manager@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/properties');
  await page.getByRole('link', { name: PROPERTY, exact: true }).click();

  const unitRow = page.getByRole('row', { name: new RegExp(`${UNIT_LABEL}.*2 bd`) });
  await expect(unitRow).toContainText('Occupied');
  await expect(unitRow).toContainText(TENANT);
});
