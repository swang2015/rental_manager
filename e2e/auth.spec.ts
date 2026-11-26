import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers';

test('owner signs in and sees the dashboard', async ({ page }) => {
  await signIn(page, 'owner@sunrise.test');
  await page.waitForURL('**/dashboard');

  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByText('Sunrise Rentals').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Occupancy', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Members' })).toBeVisible();
});

test('a wrong password is rejected with a generic message', async ({ page }) => {
  await signIn(page, 'owner@sunrise.test', 'not-the-password');

  await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('a tenant lands on the portal', async ({ page }) => {
  await signIn(page, 'tenant@sunrise.test');
  await page.waitForURL('**/portal');

  await expect(page.getByRole('heading', { name: 'Hello, Alice Chen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Maintenance', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);
});

test('staff cannot open member management', async ({ page }) => {
  await signIn(page, 'staff@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/members');
  await expect(page).toHaveURL(/\/dashboard\?error=/);
  await expect(page.getByText('You do not have permission for that action')).toBeVisible();
});

test('a narrow viewport supports keyboard sign-in without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill('tenant@sunrise.test');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('**/portal');
  await expect(page.getByRole('heading', { name: 'Hello, Alice Chen' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('a manager invitation can be accepted and opens the workspace', async ({ page }) => {
  await signIn(page, 'owner@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/members');
  await page.getByLabel('Email').fill('newmanager@e2e.test');
  await page.getByLabel('Role').selectOption('PROPERTY_MANAGER');
  await page.getByRole('button', { name: 'Create invitation' }).click();

  await expect(page.getByText(/Share this invitation link:/)).toBeVisible();
  const invitePath = (await page.locator('code').first().innerText()).trim();
  expect(invitePath).toMatch(/^\/accept-invitation\//);

  await signOut(page);

  await page.goto(invitePath);
  await expect(page.getByRole('heading', { name: 'Join Sunrise Rentals' })).toBeVisible();
  await page.getByLabel('Your name').fill('E2E Manager');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Accept invitation' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('E2E Manager').first()).toBeVisible();
  await expect(page.getByText('Property manager').first()).toBeVisible();
});

test('the platform administrator opens the console and any workspace', async ({ page }) => {
  await signIn(page, 'admin@rental.test');
  await page.waitForURL('**/admin');

  await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  await expect(page.getByText('Sunrise Rentals').first()).toBeVisible();

  await page.getByRole('button', { name: 'Open workspace' }).first().click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('link', { name: 'All organizations' })).toBeVisible();
});

test('an owner cannot open the admin console', async ({ page }) => {
  await signIn(page, 'owner@sunrise.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});
