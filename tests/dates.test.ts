import { describe, expect, it } from 'vitest';
import {
  chargeStatus,
  daysLate,
  dueDateFor,
  formatMoney,
  monthEnd,
  monthStart,
  parseDateInput,
  parseMoneyToCents,
  parseMonthKey,
} from '@/lib/domain/dates';

describe('money', () => {
  it('formats cents as currency', () => {
    expect(formatMoney(420_000)).toContain('4,200.00');
  });

  it('parses amounts with up to two decimals', () => {
    expect(parseMoneyToCents('3200')).toBe(320_000);
    expect(parseMoneyToCents('3,200.50')).toBe(320_050);
    expect(parseMoneyToCents('¥ 1200.05')).toBe(120_005);
  });

  it('rejects malformed amounts', () => {
    expect(() => parseMoneyToCents('12.345')).toThrow();
    expect(() => parseMoneyToCents('abc')).toThrow();
    expect(() => parseMoneyToCents('-5')).toThrow();
  });
});

describe('dates', () => {
  it('parses ISO date inputs as UTC midnight', () => {
    expect(parseDateInput('2026-06-01').toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(() => parseDateInput('06/01/2026')).toThrow();
  });

  it('computes month boundaries', () => {
    expect(monthStart(2026, 2).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(monthEnd(2026, 2).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(monthEnd(2024, 2).toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('clamps the due day to 28', () => {
    expect(dueDateFor(monthStart(2026, 6), 5).toISOString()).toBe('2026-06-05T00:00:00.000Z');
    expect(dueDateFor(monthStart(2026, 6), 31).toISOString()).toBe('2026-06-28T00:00:00.000Z');
  });

  it('falls back to the current month for bad input', () => {
    const now = new Date('2026-03-15T00:00:00.000Z');
    expect(parseMonthKey(undefined, now)).toEqual({ year: 2026, month: 3 });
    expect(parseMonthKey('2026-11', now)).toEqual({ year: 2026, month: 11 });
    expect(parseMonthKey('2026-99', now)).toEqual({ year: 2026, month: 3 });
  });
});

describe('charge status', () => {
  const base = { amountCents: 100_000, balanceCents: 100_000, dueDate: new Date('2026-06-05T00:00:00.000Z') };
  const now = new Date('2026-06-10T12:00:00.000Z');

  it('marks a zero balance as paid', () => {
    expect(chargeStatus({ ...base, balanceCents: 0 }, 'UTC', now)).toBe('paid');
  });

  it('marks a positive balance past the due date as overdue', () => {
    expect(chargeStatus(base, 'UTC', now)).toBe('overdue');
    expect(daysLate(base, 'UTC', now)).toBe(5);
  });

  it('marks partial payments before the due date as partial', () => {
    expect(
      chargeStatus({ ...base, balanceCents: 40_000 }, 'UTC', new Date('2026-06-01T00:00:00.000Z')),
    ).toBe('partial');
  });

  it('uses the organization timezone to decide overdue', () => {
    // 2026-06-05 23:30 UTC is already 2026-06-06 in Shanghai.
    const lateEvening = new Date('2026-06-05T23:30:00.000Z');
    expect(chargeStatus(base, 'UTC', lateEvening)).toBe('unpaid');
    expect(chargeStatus(base, 'Asia/Shanghai', lateEvening)).toBe('overdue');
  });
});
