import { redirect } from 'next/navigation';
import { DomainError } from '@/lib/domain/errors';
import { parseDateInput, parseMoneyToCents } from '@/lib/domain/dates';

export function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function formOptionalValue(form: FormData, key: string): string | null {
  const value = formValue(form, key);
  return value.length > 0 ? value : null;
}

export function formNumber(form: FormData, key: string): number {
  const value = Number(formValue(form, key));
  if (!Number.isFinite(value)) throw new Error(`Enter a valid number for ${key}.`);
  return value;
}

export function formMoneyCents(form: FormData, key: string): number {
  return parseMoneyToCents(formValue(form, key));
}

export function formDate(form: FormData, key: string): Date {
  return parseDateInput(formValue(form, key));
}

export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, 'http://internal');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export function fail(path: string, error: unknown, extra: Record<string, string | undefined> = {}): never {
  const message =
    error instanceof DomainError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';
  redirect(withQuery(path, { ...extra, error: message }));
}

export function succeed(path: string, message: string, extra: Record<string, string | undefined> = {}): never {
  redirect(withQuery(path, { ...extra, ok: message }));
}

export function searchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}
