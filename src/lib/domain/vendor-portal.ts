import type { WorkOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import { assertFound } from '@/lib/domain/errors';
import { updateWorkOrderStatus } from '@/lib/domain/maintenance';

const INCLUDE = {
  vendor: true,
  request: {
    include: {
      unit: { include: { property: { include: { owner: true } } } },
      tenant: true,
      events: { orderBy: { createdAt: 'desc' } },
    },
  },
  events: { orderBy: { createdAt: 'desc' } },
} as const;

export async function listVendorWorkOrders(vendorIds: string[]) {
  if (vendorIds.length === 0) return [];
  return prisma.workOrder.findMany({
    where: { vendorId: { in: vendorIds } },
    include: INCLUDE,
    orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
  });
}

export async function getVendorWorkOrder(vendorIds: string[], workOrderId: string) {
  if (vendorIds.length === 0) return null;
  return prisma.workOrder.findFirst({
    where: { id: workOrderId, vendorId: { in: vendorIds } },
    include: INCLUDE,
  });
}

export async function updateVendorWorkOrder(
  userId: string,
  workOrderId: string,
  input: { status: WorkOrderStatus; note?: string | null },
) {
  const workOrder = assertFound(
    await prisma.workOrder.findFirst({
      where: { id: workOrderId, vendor: { userId } },
      select: { ownerUserId: true, vendorId: true },
    }),
    'Work order not found.',
  );

  await updateWorkOrderStatus(scopedDb(workOrder.ownerUserId), workOrder.ownerUserId, workOrderId, {
    status: input.status,
    note: input.note ?? null,
    actorUserId: userId,
  });
}
