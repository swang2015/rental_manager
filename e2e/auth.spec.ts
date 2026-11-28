import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers';

test('owner signs in and sees the dashboard', async ({ page }) => {
  await signIn(page, 'owner@rental.test');
  await page.waitForURL('**/dashboard');

  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByText('Olivia Owner').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Occupancy', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vendors' })).toBeVisible();
});

test('a wrong password is rejected with a generic message', async ({ page }) => {
  await signIn(page, 'owner@rental.test', 'not-the-password');

  await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('a tenant lands on the portal', async ({ page }) => {
  await signIn(page, 'tenant@rental.test');
  await page.waitForURL('**/portal');

  await expect(page.getByRole('heading', { name: 'Hello, Alice Chen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Maintenance', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vendors' })).toHaveCount(0);
});

test('a tenant cannot open the owner workspace', async ({ page }) => {
  await signIn(page, 'tenant@rental.test');
  await page.waitForURL('**/portal');

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/portal$/);
});

test('a vendor lands on the work order queue', async ({ page }) => {
  await signIn(page, 'vendor@rental.test');
  await page.waitForURL('**/vendor');

  await expect(page.getByRole('heading', { name: 'Assigned work orders' })).toBeVisible();
  await expect(page.getByText('Vic Plumbing Co.', { exact: false })).toBeVisible();
});

test('the platform administrator opens the console and any owner workspace', async ({ page }) => {
  await signIn(page, 'admin@rental.test');
  await page.waitForURL('**/admin');

  await expect(page.getByRole('heading', { name: 'Platform administration' })).toBeVisible();
  await expect(page.getByText('Olivia Owner').first()).toBeVisible();

  await page.getByRole('button', { name: 'Open workspace' }).first().click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('link', { name: 'Platform admin' })).toBeVisible();
});

test('an owner cannot open the admin console', async ({ page }) => {
  await signIn(page, 'owner@rental.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a narrow viewport supports keyboard sign-in without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill('tenant@rental.test');
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

test('an owner invitation can be accepted and opens the tenant portal', async ({ page }) => {
  await signIn(page, 'owner@rental.test');
  await page.waitForURL('**/dashboard');

  await page.goto('/tenants');
  await page.getByLabel('Tenant email').fill('newtenant@e2e.test');
  await page.getByRole('button', { name: 'Create invitation link' }).click();

  await expect(page.getByText(/Share this invitation link:/)).toBeVisible();
  const invitePath = (await page.locator('code').first().innerText()).trim();
  expect(invitePath).toMatch(/^\/accept-invitation\//);

  await signOut(page);

  await page.goto(invitePath);
  await expect(page.getByRole('heading', { name: /Join Olivia Owner.s portfolio/ })).toBeVisible();
  await page.getByLabel('Your name').fill('New Tenant');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Accept invitation' }).click();

  await page.waitForURL('**/portal');
  await expect(page.getByRole('heading', { name: 'Hello, New Tenant' })).toBeVisible();
});

test('an application is approved by the platform administrator', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: 'Request an account' })).toBeVisible();
  await page.getByLabel('Your name').fill('Pending Owner');
  await page.getByLabel('Email').fill('applicant@e2e.test');
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('I am a').selectOption('OWNER');
  await page.getByRole('button', { name: 'Request access' }).click();

  await page.waitForURL('**/onboarding');
  await expect(page.getByText('waiting for a platform administrator')).toBeVisible();

  await signOut(page);

  await signIn(page, 'admin@rental.test');
  await page.waitForURL('**/admin');
  const row = page.getByRole('row', { name: /Pending Owner/ });
  await row.locator('select').selectOption('OWNER');
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Account approved.')).toBeVisible();

  await signOut(page);

  await signIn(page, 'applicant@e2e.test');
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Pending Owner').first()).toBeVisible();
});
