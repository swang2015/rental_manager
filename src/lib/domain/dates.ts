const CURRENCY = 'CNY';

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[,\s¥￥$]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid amount with at most two decimals.');
  }
  return Math.round(Number(cleaned) * 100);
}

export function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function parseDateInput(input: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error('Enter a valid date.');
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date.');
  return date;
}

export function formatDate(value: Date, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(input: string | undefined, now = new Date()): { year: number; month: number } {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [year, month] = input.split('-').map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function dueDateFor(periodStart: Date, dueDay: number): Date {
  return new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), Math.min(Math.max(dueDay, 1), 28)),
  );
}

export type ChargeStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export function chargeStatus(
  charge: { amountCents: number; balanceCents: number; dueDate: Date },
  timezone: string,
  now = new Date(),
): ChargeStatus {
  if (charge.balanceCents <= 0) return 'paid';
  const today = formatDate(now, timezone);
  const due = formatDate(charge.dueDate, 'UTC');
  if (due < today) return 'overdue';
  const paidSoFar = charge.amountCents - charge.balanceCents;
  return paidSoFar > 0 ? 'partial' : 'unpaid';
}

export function daysLate(
  charge: { balanceCents: number; dueDate: Date },
  timezone: string,
  now = new Date(),
): number {
  if (charge.balanceCents <= 0) return 0;
  const today = formatDate(now, timezone);
  const due = formatDate(charge.dueDate, 'UTC');
  if (due >= today) return 0;
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const dueDate = new Date(`${due}T00:00:00.000Z`);
  return Math.max(0, Math.round((todayDate.getTime() - dueDate.getTime()) / 86_400_000));
}
