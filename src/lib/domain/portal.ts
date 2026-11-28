import type { ScopedDb } from '@/lib/db/scoped';
import { chargeStatus, daysLate } from '@/lib/domain/dates';

export async function getTenantLeases(db: ScopedDb, tenantId: string) {
  return db.lease.findMany({
    where: { tenantId },
    include: { unit: { include: { property: true } } },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });
}

export async function getTenantCharges(db: ScopedDb, tenantId: string, timezone: string) {
  const charges = await db.rentCharge.findMany({
    where: { lease: { tenantId } },
    include: {
      lease: { include: { unit: { include: { property: true } } } },
      payments: { orderBy: { paidOn: 'desc' } },
      adjustments: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { dueDate: 'desc' },
  });

  return charges.map((charge) => ({
    ...charge,
    paidCents: charge.amountCents - charge.balanceCents,
    status: chargeStatus(charge, timezone),
    daysLate: daysLate(charge, timezone),
  }));
}

export type TenantCharge = Awaited<ReturnType<typeof getTenantCharges>>[number];

export async function listTenantRequests(db: ScopedDb, tenantId: string) {
  return db.maintenanceRequest.findMany({
    where: { tenantId },
    include: {
      unit: { include: { property: true } },
      workOrder: { include: { vendor: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTenantRequest(db: ScopedDb, tenantId: string, requestId: string) {
  return db.maintenanceRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      unit: { include: { property: true } },
      workOrder: { include: { vendor: true } },
      events: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function getTenantHome(db: ScopedDb, tenantId: string, timezone: string) {
  const leases = await getTenantLeases(db, tenantId);
  const activeLease = leases.find((lease) => lease.status === 'ACTIVE') ?? null;
  const charges = await getTenantCharges(db, tenantId, timezone);
  const openRequests = await db.maintenanceRequest.count({
    where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  });

  const outstanding = charges.reduce((sum, charge) => sum + charge.balanceCents, 0);
  const nextDue =
    charges
      .filter((charge) => charge.balanceCents > 0)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
  const overdue = charges.filter((charge) => charge.status === 'overdue');

  return { activeLease, leases, outstanding, nextDue, openRequests, overdue };
}
