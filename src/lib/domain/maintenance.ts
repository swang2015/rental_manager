import type { WorkOrderStatus } from '@prisma/client';
import type { ScopedDb } from '@/lib/db/scoped';
import { assertCondition, assertFound } from '@/lib/domain/errors';

const WORK_ORDER_FLOW: WorkOrderStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export function listRequests(
  db: ScopedDb,
  options: {
    propertyId?: string;
    status?: string;
    priority?: string;
    category?: string;
    vendorId?: string;
    search?: string;
  } = {},
) {
  const search = options.search?.trim();
  return db.maintenanceRequest.findMany({
    where: {
      ...(options.propertyId ? { unit: { propertyId: options.propertyId } } : {}),
      ...(options.status
        ? { status: options.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED' }
        : {}),
      ...(options.priority ? { priority: options.priority as 'LOW' | 'MEDIUM' | 'URGENT' } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.vendorId ? { workOrder: { vendorId: options.vendorId } } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { tenant: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      unit: { include: { property: true } },
      tenant: true,
      workOrder: { include: { vendor: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getRequest(db: ScopedDb, requestId: string) {
  return db.maintenanceRequest.findFirst({
    where: { id: requestId },
    include: {
      unit: { include: { property: true } },
      tenant: true,
      workOrder: { include: { vendor: true, events: { orderBy: { createdAt: 'desc' } } } },
      events: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function createRequest(
  db: ScopedDb,
  ownerUserId: string,
  input: {
    unitId: string;
    tenantId: string;
    category: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'URGENT';
    createdByUserId?: string | null;
  },
) {
  assertCondition(input.category.trim().length > 0, 'Choose a category.');
  assertCondition(input.description.trim().length > 0, 'Describe the issue.');

  const request = await db.maintenanceRequest.create({
    data: {
      ownerUserId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      category: input.category.trim(),
      description: input.description.trim(),
      priority: input.priority ?? 'MEDIUM',
      status: 'OPEN',
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await db.requestEvent.create({
    data: {
      ownerUserId,
      requestId: request.id,
      fromStatus: null,
      toStatus: 'OPEN',
      note: 'Request submitted',
      actorUserId: input.createdByUserId ?? null,
    },
  });

  return request;
}

export async function triageRequest(
  db: ScopedDb,
  ownerUserId: string,
  requestId: string,
  input: { priority: 'LOW' | 'MEDIUM' | 'URGENT'; note?: string | null; actorUserId: string },
) {
  const request = assertFound(await getRequest(db, requestId), 'Request not found.');
  assertCondition(
    request.status === 'OPEN' || request.status === 'IN_PROGRESS',
    'Only open requests can be triaged.',
    'invalid_state',
  );

  await db.maintenanceRequest.updateMany({
    where: { id: requestId },
    data: { priority: input.priority, triageNote: input.note?.trim() || null },
  });

  await db.requestEvent.create({
    data: {
      ownerUserId,
      requestId,
      fromStatus: request.status,
      toStatus: request.status,
      note: `Priority set to ${input.priority.toLowerCase()}${
        input.note?.trim() ? `: ${input.note.trim()}` : ''
      }`,
      actorUserId: input.actorUserId,
    },
  });
}

export async function createWorkOrder(
  db: ScopedDb,
  ownerUserId: string,
  requestId: string,
  input: { vendorId: string; scheduledFor: Date; actorUserId: string; note?: string | null },
) {
  const request = assertFound(await getRequest(db, requestId), 'Request not found.');
  assertCondition(
    request.status === 'OPEN',
    'Only an open request can become a work order.',
    'invalid_state',
  );
  assertCondition(request.workOrder === null, 'This request already has a work order.', 'conflict');

  assertFound(
    await db.vendor.findFirst({ where: { id: input.vendorId, status: 'ACTIVE' } }),
    'Vendor not found.',
  );

  await db.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.create({
      data: {
        ownerUserId,
        requestId,
        vendorId: input.vendorId,
        scheduledFor: input.scheduledFor,
        status: 'SCHEDULED',
      },
    });

    await tx.workOrderEvent.create({
      data: {
        ownerUserId,
        workOrderId: workOrder.id,
        fromStatus: null,
        toStatus: 'SCHEDULED',
        note: input.note?.trim() || 'Work order created and assigned',
        actorUserId: input.actorUserId,
      },
    });

    await tx.maintenanceRequest.updateMany({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS' },
    });

    await tx.requestEvent.create({
      data: {
        ownerUserId,
        requestId,
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        note: 'Work order assigned',
        actorUserId: input.actorUserId,
      },
    });
  });
}

export async function reassignWorkOrder(
  db: ScopedDb,
  ownerUserId: string,
  workOrderId: string,
  input: { vendorId: string; actorUserId: string },
) {
  const workOrder = assertFound(
    await db.workOrder.findFirst({ where: { id: workOrderId } }),
    'Work order not found.',
  );
  assertCondition(
    workOrder.status !== 'CLOSED',
    'A closed work order cannot be reassigned.',
    'invalid_state',
  );

  await db.workOrder.updateMany({
    where: { id: workOrderId },
    data: { vendorId: input.vendorId },
  });

  await db.workOrderEvent.create({
    data: {
      ownerUserId,
      workOrderId,
      fromStatus: workOrder.status,
      toStatus: workOrder.status,
      note: 'Reassigned',
      actorUserId: input.actorUserId,
    },
  });
}

export async function updateWorkOrderStatus(
  db: ScopedDb,
  ownerUserId: string,
  workOrderId: string,
  input: { status: WorkOrderStatus; note?: string | null; actorUserId: string },
) {
  await db.$transaction(async (tx) => {
    const workOrder = assertFound(
      await tx.workOrder.findFirst({
        where: { id: workOrderId, ownerUserId },
        include: { request: true },
      }),
      'Work order not found.',
    );

    const currentIndex = WORK_ORDER_FLOW.indexOf(workOrder.status);
    const nextIndex = WORK_ORDER_FLOW.indexOf(input.status);
    assertCondition(
      nextIndex > currentIndex,
      'Work orders move forward through scheduled, in progress, resolved, then closed.',
      'invalid_state',
    );
    assertCondition(
      input.status !== 'RESOLVED' || Boolean(input.note?.trim()),
      'A resolution note is required before resolving.',
    );

    await tx.workOrder.updateMany({
      where: { id: workOrderId, ownerUserId },
      data: {
        status: input.status,
        ...(input.status === 'RESOLVED' ? { resolutionNote: input.note!.trim() } : {}),
        ...(input.status === 'CLOSED' ? { closedAt: new Date() } : {}),
      },
    });

    await tx.workOrderEvent.create({
      data: {
        ownerUserId,
        workOrderId,
        fromStatus: workOrder.status,
        toStatus: input.status,
        note: input.note?.trim() || null,
        actorUserId: input.actorUserId,
      },
    });

    const requestStatus =
      input.status === 'RESOLVED'
        ? 'RESOLVED'
        : input.status === 'CLOSED'
          ? 'CLOSED'
          : 'IN_PROGRESS';

    if (workOrder.request.status !== requestStatus) {
      await tx.maintenanceRequest.updateMany({
        where: { id: workOrder.requestId, ownerUserId },
        data: { status: requestStatus },
      });
      await tx.requestEvent.create({
        data: {
          ownerUserId,
          requestId: workOrder.requestId,
          fromStatus: workOrder.request.status,
          toStatus: requestStatus,
          note: input.note?.trim() || null,
          actorUserId: input.actorUserId,
        },
      });
    }
  });
}

export async function cancelRequest(
  db: ScopedDb,
  ownerUserId: string,
  requestId: string,
  input: { reason: string; actorUserId: string },
) {
  assertCondition(input.reason.trim().length > 0, 'A cancellation reason is required.');

  await db.$transaction(async (tx) => {
    const request = assertFound(
      await tx.maintenanceRequest.findFirst({
        where: { id: requestId, ownerUserId },
        include: { workOrder: true },
      }),
      'Request not found.',
    );
    assertCondition(
      request.status === 'OPEN' || request.status === 'IN_PROGRESS',
      'Only an open request can be cancelled.',
      'invalid_state',
    );

    await tx.maintenanceRequest.updateMany({
      where: { id: requestId, ownerUserId },
      data: { status: 'CANCELLED', cancelledReason: input.reason.trim() },
    });

    await tx.requestEvent.create({
      data: {
        ownerUserId,
        requestId,
        fromStatus: request.status,
        toStatus: 'CANCELLED',
        note: input.reason.trim(),
        actorUserId: input.actorUserId,
      },
    });

    if (request.workOrder && request.workOrder.status !== 'CLOSED') {
      await tx.workOrder.updateMany({
        where: { id: request.workOrder.id, ownerUserId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await tx.workOrderEvent.create({
        data: {
          ownerUserId,
          workOrderId: request.workOrder.id,
          fromStatus: request.workOrder.status,
          toStatus: 'CLOSED',
          note: `Request cancelled: ${input.reason.trim()}`,
          actorUserId: input.actorUserId,
        },
      });
    }
  });
}

export async function listAssignableVendors(db: ScopedDb) {
  return db.vendor.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true },
    orderBy: { name: 'asc' },
  });
}

export async function listCategories(db: ScopedDb): Promise<string[]> {
  const rows = await db.maintenanceRequest.groupBy({
    by: ['category'],
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((row) => row.category);
}
