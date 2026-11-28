import { beforeEach, describe, expect, it } from 'vitest';
import { scopedDb } from '@/lib/db/scoped';
import {
  ensureChargesForPeriod,
  getCharge,
  recordAdjustment,
  recordPayment,
} from '@/lib/domain/billing';
import {
  createLease,
  createOwner,
  createProperty,
  createTenant,
  createUnit,
  createUser,
  resetDb,
} from './helpers';

async function fixture() {
  const org = await createOwner('Billing Org');
  const property = await createProperty(org.id);
  const unit = await createUnit(org.id, property.id, '1A', 100_000);
  const tenant = await createTenant(org.id);
  const lease = await createLease({
    ownerUserId: org.id,
    unitId: unit.id,
    tenantId: tenant.id,
    rentAmountCents: 100_000,
    dueDay: 5,
  });
  const user = await createUser('manager@billing.test');
  return { org, property, unit, tenant, lease, user, db: scopedDb(org.id) };
}

describe('rent billing', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('generates one charge per active lease and is idempotent', async () => {
    const { org, db } = await fixture();

    const first = await ensureChargesForPeriod(db, org.id, { year: 2026, month: 6 });
    const second = await ensureChargesForPeriod(db, org.id, { year: 2026, month: 6 });

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(await db.rentCharge.count()).toBe(1);

    const charge = await db.rentCharge.findFirst();
    expect(charge?.amountCents).toBe(100_000);
    expect(charge?.balanceCents).toBe(100_000);
    expect(charge?.dueDate.toISOString()).toBe('2026-06-05T00:00:00.000Z');
  });

  it('does not generate charges for ended leases', async () => {
    const { org, property, tenant, db } = await fixture();
    const endedLease = await createLease({
      ownerUserId: org.id,
      unitId: (await createUnit(org.id, property.id, '2B')).id,
      tenantId: tenant.id,
      status: 'ENDED',
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    await ensureChargesForPeriod(db, org.id, { year: 2026, month: 5 });
    expect(await db.rentCharge.count({ where: { leaseId: endedLease.id } })).toBe(0);
  });

  it('records partial then full payments and rejects overpayment', async () => {
    const { org, user, db } = await fixture();
    await ensureChargesForPeriod(db, org.id, { year: 2026, month: 12 });
    const charge = await db.rentCharge.findFirstOrThrow();

    await recordPayment(db, org.id, charge.id, {
      amountCents: 40_000,
      paidOn: new Date('2026-12-02T00:00:00.000Z'),
      method: 'BANK_TRANSFER',
      recordedByUserId: user.id,
    });

    let current = await getCharge(db, 'UTC', charge.id);
    expect(current?.balanceCents).toBe(60_000);
    expect(current?.status).toBe('partial');

    await expect(
      recordPayment(db, org.id, charge.id, {
        amountCents: 70_000,
        paidOn: new Date('2026-12-03T00:00:00.000Z'),
        method: 'CASH',
        recordedByUserId: user.id,
      }),
    ).rejects.toThrow(/exceeds the outstanding balance/);

    current = await getCharge(db, 'UTC', charge.id);
    expect(current?.balanceCents).toBe(60_000);

    await recordPayment(db, org.id, charge.id, {
      amountCents: 60_000,
      paidOn: new Date('2026-12-04T00:00:00.000Z'),
      method: 'CASH',
      recordedByUserId: user.id,
    });

    current = await getCharge(db, 'UTC', charge.id);
    expect(current?.balanceCents).toBe(0);
    expect(current?.status).toBe('paid');
    expect(current?.payments).toHaveLength(2);
  });

  it('caps adjustments at the outstanding balance', async () => {
    const { org, user, db } = await fixture();
    await ensureChargesForPeriod(db, org.id, { year: 2026, month: 6 });
    const charge = await db.rentCharge.findFirstOrThrow();

    await expect(
      recordAdjustment(db, org.id, charge.id, {
        amountCents: 150_000,
        reason: 'Too much',
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/exceeds the outstanding balance/);

    await recordAdjustment(db, org.id, charge.id, {
      amountCents: 20_000,
      reason: 'Repair credit',
      createdByUserId: user.id,
    });

    const current = await getCharge(db, 'UTC', charge.id);
    expect(current?.balanceCents).toBe(80_000);
    expect(current?.adjustments).toHaveLength(1);
    expect(current?.payments).toHaveLength(0);
  });

  it('derives overdue status from the due date', async () => {
    const { org, db } = await fixture();
    await ensureChargesForPeriod(db, org.id, { year: 2026, month: 6 });
    const charge = await db.rentCharge.findFirstOrThrow();

    const current = await getCharge(db, 'UTC', charge.id);
    expect(current?.status).toBe('overdue');
    expect(current?.daysLate).toBeGreaterThan(0);
  });
});
