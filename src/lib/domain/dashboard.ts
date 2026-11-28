import type { ScopedDb } from '@/lib/db/scoped';
import { monthEnd, monthStart } from '@/lib/domain/dates';

export async function occupancySummary(db: ScopedDb, propertyId?: string) {
  const grouped = await db.unit.groupBy({
    by: ['status'],
    where: { archivedAt: null, ...(propertyId ? { propertyId } : {}) },
    _count: { _all: true },
  });

  const counts = { AVAILABLE: 0, OCCUPIED: 0, OFF_MARKET: 0 };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  const total = counts.AVAILABLE + counts.OCCUPIED + counts.OFF_MARKET;
  const occupancyRate = total === 0 ? 0 : Math.round((counts.OCCUPIED / total) * 100);

  return { total, ...counts, occupancyRate };
}

export async function maintenanceSummary(db: ScopedDb, now = new Date(), propertyId?: string) {
  const openStatuses = ['OPEN', 'IN_PROGRESS'] as const;
  const staleBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const requests = await db.maintenanceRequest.findMany({
    where: {
      status: { in: [...openStatuses] },
      ...(propertyId ? { unit: { propertyId } } : {}),
    },
    select: {
      id: true,
      priority: true,
      createdAt: true,
      workOrder: { select: { vendorId: true } },
    },
  });

  const byPriority = { LOW: 0, MEDIUM: 0, URGENT: 0 };
  let unassigned = 0;
  let stale = 0;

  for (const request of requests) {
    byPriority[request.priority] += 1;
    if (!request.workOrder || !request.workOrder.vendorId) unassigned += 1;
    if (request.createdAt.getTime() < staleBefore.getTime()) stale += 1;
  }

  return { open: requests.length, byPriority, unassigned, stale };
}

export async function monthlyRentTotals(
  db: ScopedDb,
  timezone: string,
  now = new Date(),
  propertyId?: string,
) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const charges = await db.rentCharge.findMany({
    where: {
      periodStart: { gte: monthStart(year, month), lte: monthEnd(year, month) },
      ...(propertyId ? { lease: { unit: { propertyId } } } : {}),
    },
    select: { amountCents: true, balanceCents: true, dueDate: true },
  });

  let billed = 0;
  let outstanding = 0;
  let collected = 0;
  let overdue = 0;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);

  for (const charge of charges) {
    billed += charge.amountCents;
    outstanding += charge.balanceCents;
    collected += charge.amountCents - charge.balanceCents;
    if (charge.balanceCents > 0 && charge.dueDate.toISOString().slice(0, 10) < today) {
      overdue += 1;
    }
  }

  return { billed, collected, outstanding, overdue };
}
