import type { PaymentMethod } from '@prisma/client';
import type { ScopedDb } from '@/lib/db/scoped';
import { assertCondition, assertFound } from '@/lib/domain/errors';
import {
  chargeStatus,
  daysLate,
  dueDateFor,
  monthEnd,
  monthStart,
  type ChargeStatus,
} from '@/lib/domain/dates';

export type ChargeRow = {
  id: string;
  amountCents: number;
  balanceCents: number;
  paidCents: number;
  periodStart: Date;
  dueDate: Date;
  status: ChargeStatus;
  daysLate: number;
  lease: {
    id: string;
    tenant: { id: string; name: string; email: string };
    unit: { id: string; label: string; property: { id: string; name: string } };
  };
  payments: {
    id: string;
    amountCents: number;
    paidOn: Date;
    method: PaymentMethod;
    reference: string | null;
  }[];
  adjustments: { id: string; amountCents: number; reason: string; createdAt: Date }[];
};

type ChargeRecord = {
  id: string;
  amountCents: number;
  balanceCents: number;
  periodStart: Date;
  dueDate: Date;
  lease: ChargeRow['lease'];
  payments: ChargeRow['payments'];
  adjustments: ChargeRow['adjustments'];
};

function toRow(charge: ChargeRecord, timezone: string): ChargeRow {
  return {
    id: charge.id,
    amountCents: charge.amountCents,
    balanceCents: charge.balanceCents,
    paidCents: charge.amountCents - charge.balanceCents,
    periodStart: charge.periodStart,
    dueDate: charge.dueDate,
    status: chargeStatus(charge, timezone),
    daysLate: daysLate(charge, timezone),
    lease: charge.lease,
    payments: charge.payments,
    adjustments: charge.adjustments,
  };
}

const CHARGE_INCLUDE = {
  lease: {
    include: {
      tenant: { select: { id: true, name: true, email: true } },
      unit: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
    },
  },
  payments: { orderBy: { paidOn: 'desc' } },
  adjustments: { orderBy: { createdAt: 'desc' } },
} as const;

export async function ensureChargesForPeriod(
  db: ScopedDb,
  ownerUserId: string,
  period: { year: number; month: number },
): Promise<number> {
  const start = monthStart(period.year, period.month);
  const end = monthEnd(period.year, period.month);

  const leases = await db.lease.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, rentAmountCents: true, dueDay: true },
  });

  if (leases.length === 0) return 0;

  const result = await db.rentCharge.createMany({
    data: leases.map((lease) => ({
      ownerUserId,
      leaseId: lease.id,
      periodStart: start,
      dueDate: dueDateFor(start, lease.dueDay),
      amountCents: lease.rentAmountCents,
      balanceCents: lease.rentAmountCents,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function listCharges(
  db: ScopedDb,
  timezone: string,
  options: {
    year: number;
    month: number;
    status?: ChargeStatus | '';
    propertyId?: string;
    tenantId?: string;
    search?: string;
  },
): Promise<{
  rows: ChargeRow[];
  totals: {
    billedCents: number;
    collectedCents: number;
    outstandingCents: number;
    overdueCount: number;
  };
}> {
  const start = monthStart(options.year, options.month);
  const end = monthEnd(options.year, options.month);
  const search = options.search?.trim();

  const charges = await db.rentCharge.findMany({
    where: {
      periodStart: { gte: start, lte: end },
      ...(options.propertyId ? { lease: { unit: { propertyId: options.propertyId } } } : {}),
      ...(options.tenantId ? { lease: { tenantId: options.tenantId } } : {}),
      ...(search
        ? {
            lease: {
              ...(options.propertyId ? { unit: { propertyId: options.propertyId } } : {}),
              ...(options.tenantId ? { tenantId: options.tenantId } : {}),
              tenant: { name: { contains: search, mode: 'insensitive' } },
            },
          }
        : {}),
    },
    include: CHARGE_INCLUDE,
    orderBy: [{ dueDate: 'asc' }],
  });

  const all = charges.map((charge) => toRow(charge as ChargeRecord, timezone));
  const rows = options.status ? all.filter((row) => row.status === options.status) : all;

  const totals = rows.reduce(
    (acc, row) => {
      acc.billedCents += row.amountCents;
      acc.collectedCents += row.paidCents;
      acc.outstandingCents += row.balanceCents;
      if (row.status === 'overdue') acc.overdueCount += 1;
      return acc;
    },
    { billedCents: 0, collectedCents: 0, outstandingCents: 0, overdueCount: 0 },
  );

  return { rows, totals };
}

export async function getCharge(db: ScopedDb, timezone: string, chargeId: string) {
  const charge = await db.rentCharge.findFirst({
    where: { id: chargeId },
    include: CHARGE_INCLUDE,
  });
  return charge ? toRow(charge as ChargeRecord, timezone) : null;
}

export async function recordPayment(
  db: ScopedDb,
  ownerUserId: string,
  chargeId: string,
  input: {
    amountCents: number;
    paidOn: Date;
    method: PaymentMethod;
    reference?: string | null;
    recordedByUserId: string;
  },
): Promise<void> {
  assertCondition(input.amountCents > 0, 'Payment amount must be greater than zero.');

  await db.$transaction(async (tx) => {
    const charge = assertFound(
      await tx.rentCharge.findFirst({ where: { id: chargeId, ownerUserId } }),
      'Charge not found.',
    );
    assertCondition(
      input.amountCents <= charge.balanceCents,
      'The payment exceeds the outstanding balance.',
    );

    await tx.payment.create({
      data: {
        ownerUserId,
        chargeId,
        amountCents: input.amountCents,
        paidOn: input.paidOn,
        method: input.method,
        reference: input.reference?.trim() || null,
        recordedByUserId: input.recordedByUserId,
      },
    });

    await tx.rentCharge.updateMany({
      where: { id: chargeId, ownerUserId },
      data: { balanceCents: { decrement: input.amountCents } },
    });
  });
}

export async function recordAdjustment(
  db: ScopedDb,
  ownerUserId: string,
  chargeId: string,
  input: { amountCents: number; reason: string; createdByUserId: string },
): Promise<void> {
  assertCondition(input.amountCents > 0, 'Adjustment amount must be greater than zero.');
  assertCondition(input.reason.trim().length > 0, 'An adjustment reason is required.');

  await db.$transaction(async (tx) => {
    const charge = assertFound(
      await tx.rentCharge.findFirst({ where: { id: chargeId, ownerUserId } }),
      'Charge not found.',
    );
    assertCondition(
      input.amountCents <= charge.balanceCents,
      'The adjustment exceeds the outstanding balance.',
    );

    await tx.adjustment.create({
      data: {
        ownerUserId,
        chargeId,
        amountCents: input.amountCents,
        reason: input.reason.trim(),
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.rentCharge.updateMany({
      where: { id: chargeId, ownerUserId },
      data: { balanceCents: { decrement: input.amountCents } },
    });
  });
}

export async function rentSummary(
  db: ScopedDb,
  timezone: string,
  period: { year: number; month: number },
  propertyId?: string,
) {
  const { totals } = await listCharges(db, timezone, {
    year: period.year,
    month: period.month,
    propertyId,
  });
  return totals;
}
