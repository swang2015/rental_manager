import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'password123';

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
}

/**
 * Selects the option whose visible text matches, without needing to know the
 * generated id that backs it.
 */
export async function selectByText(page: Page, label: string, text: string): Promise<void> {
  const select = page.getByLabel(label);
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  if (!value) throw new Error(`No option containing "${text}" for ${label}.`);
  await select.selectOption(value);
}
