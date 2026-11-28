import type { Prisma } from '@prisma/client';
import type { ScopedDb } from '@/lib/db/scoped';
import { DomainError, assertCondition, assertFound } from '@/lib/domain/errors';
import { isUniqueError } from '@/lib/domain/properties';

export type LeaseTermsInput = {
  unitId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  rentAmountCents: number;
  depositAmountCents: number;
  dueDay: number;
};

function validateTerms(input: Omit<LeaseTermsInput, 'unitId' | 'tenantId'>) {
  assertCondition(
    input.endDate.getTime() > input.startDate.getTime(),
    'The end date must be after the start date.',
  );
  assertCondition(
    input.dueDay >= 1 && input.dueDay <= 28,
    'Rent due day must be between 1 and 28.',
  );
  assertCondition(input.rentAmountCents > 0, 'Monthly rent must be greater than zero.');
  assertCondition(input.depositAmountCents >= 0, 'Deposit cannot be negative.');
}

export async function listLeases(
  db: ScopedDb,
  options: { status?: string; propertyId?: string; tenantId?: string; search?: string } = {},
) {
  const search = options.search?.trim();
  return db.lease.findMany({
    where: {
      ...(options.status ? { status: options.status as 'DRAFT' | 'ACTIVE' | 'ENDED' } : {}),
      ...(options.propertyId ? { unit: { propertyId: options.propertyId } } : {}),
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(search
        ? {
            OR: [
              { tenant: { name: { contains: search, mode: 'insensitive' } } },
              { unit: { label: { contains: search, mode: 'insensitive' } } },
              { unit: { property: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    include: {
      tenant: true,
      unit: { include: { property: true } },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });
}

export async function getLease(db: ScopedDb, leaseId: string) {
  return db.lease.findFirst({
    where: { id: leaseId },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      predecessor: true,
      successor: true,
      charges: { orderBy: { periodStart: 'desc' } },
    },
  });
}

export async function createDraftLease(db: ScopedDb, ownerUserId: string, input: LeaseTermsInput) {
  validateTerms(input);
  const unit = assertFound(
    await db.unit.findFirst({ where: { id: input.unitId }, include: { property: true } }),
    'Unit not found.',
  );
  assertCondition(unit.archivedAt === null, 'Cannot lease an archived unit.', 'invalid_state');
  assertCondition(
    unit.status === 'AVAILABLE',
    'Only an available unit can be leased.',
    'invalid_state',
  );

  const tenant = assertFound(
    await db.tenant.findFirst({ where: { id: input.tenantId } }),
    'Tenant not found.',
  );
  assertCondition(
    tenant.status === 'ACTIVE',
    'Cannot lease to an archived tenant.',
    'invalid_state',
  );

  const active = await db.lease.count({ where: { unitId: input.unitId, status: 'ACTIVE' } });
  assertCondition(active === 0, 'This unit already has an active lease.', 'conflict');

  return db.lease.create({
    data: {
      ownerUserId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      rentAmountCents: input.rentAmountCents,
      depositAmountCents: input.depositAmountCents,
      dueDay: input.dueDay,
      status: 'DRAFT',
    },
  });
}

export type LeaseUpdateInput = {
  startDate?: Date;
  endDate?: Date;
  rentAmountCents?: number;
  depositAmountCents?: number;
  dueDay?: number;
};

export async function updateLease(db: ScopedDb, leaseId: string, input: LeaseUpdateInput) {
  const lease = assertFound(await getLease(db, leaseId), 'Lease not found.');

  if (lease.status === 'ENDED') {
    throw new DomainError('An ended lease cannot be edited.', 'invalid_state');
  }

  const data: Prisma.LeaseUpdateManyMutationInput = {};

  if (lease.status === 'DRAFT') {
    const startDate = input.startDate ?? lease.startDate;
    const endDate = input.endDate ?? lease.endDate;
    const dueDay = input.dueDay ?? lease.dueDay;
    const rentAmountCents = input.rentAmountCents ?? lease.rentAmountCents;
    const depositAmountCents = input.depositAmountCents ?? lease.depositAmountCents;
    validateTerms({ startDate, endDate, dueDay, rentAmountCents, depositAmountCents });
    data.startDate = startDate;
    data.endDate = endDate;
    data.dueDay = dueDay;
    data.rentAmountCents = rentAmountCents;
    data.depositAmountCents = depositAmountCents;
  } else {
    if (input.startDate)
      throw new DomainError('An active lease start date cannot be changed.', 'invalid_state');
    if (input.depositAmountCents !== undefined) {
      throw new DomainError('An active lease deposit cannot be changed.', 'invalid_state');
    }
    if (input.endDate) {
      assertCondition(
        input.endDate.getTime() >= lease.endDate.getTime(),
        'An active lease can only be extended to a later end date.',
      );
      if (input.endDate.getTime() > lease.endDate.getTime()) {
        data.endDate = input.endDate;
      }
    }
    if (input.rentAmountCents !== undefined) {
      assertCondition(input.rentAmountCents > 0, 'Monthly rent must be greater than zero.');
      data.rentAmountCents = input.rentAmountCents;
    }
    if (input.dueDay !== undefined) {
      assertCondition(
        input.dueDay >= 1 && input.dueDay <= 28,
        'Rent due day must be between 1 and 28.',
      );
      data.dueDay = input.dueDay;
    }
  }

  const result = await db.lease.updateMany({ where: { id: leaseId }, data });
  assertCondition(result.count === 1, 'Lease not found.', 'not_found');
}

export async function activateLease(db: ScopedDb, ownerUserId: string, leaseId: string) {
  try {
    await db.$transaction(async (tx) => {
      const lease = assertFound(
        await tx.lease.findFirst({ where: { id: leaseId, ownerUserId }, include: { unit: true } }),
        'Lease not found.',
      );
      assertCondition(
        lease.status === 'DRAFT',
        'Only a draft lease can be activated.',
        'invalid_state',
      );

      const active = await tx.lease.count({
        where: {
          ownerUserId,
          unitId: lease.unitId,
          status: 'ACTIVE',
          ...(lease.predecessorLeaseId ? { id: { not: lease.predecessorLeaseId } } : {}),
        },
      });
      assertCondition(active === 0, 'This unit already has an active lease.', 'conflict');

      if (lease.predecessorLeaseId) {
        await tx.lease.updateMany({
          where: { id: lease.predecessorLeaseId, ownerUserId, status: 'ACTIVE' },
          data: { status: 'ENDED' },
        });
      }

      const updated = await tx.lease.updateMany({
        where: { id: leaseId, ownerUserId, status: 'DRAFT' },
        data: { status: 'ACTIVE' },
      });
      assertCondition(
        updated.count === 1,
        'Lease changed while activating. Reload and try again.',
        'conflict',
      );

      await tx.unit.updateMany({
        where: { id: lease.unitId, ownerUserId },
        data: { status: 'OCCUPIED' },
      });
    });
  } catch (error) {
    if (isUniqueError(error)) {
      throw new DomainError('This unit already has an active lease.', 'conflict');
    }
    throw error;
  }
}

export async function renewLease(
  db: ScopedDb,
  ownerUserId: string,
  leaseId: string,
  input: LeaseTermsInput,
) {
  const lease = assertFound(await getLease(db, leaseId), 'Lease not found.');
  assertCondition(
    lease.status === 'ACTIVE',
    'Only an active lease can be renewed.',
    'invalid_state',
  );
  assertCondition(input.unitId === lease.unitId, 'A renewal must keep the same unit.');
  assertCondition(input.tenantId === lease.tenantId, 'A renewal must keep the same tenant.');
  validateTerms(input);

  const existingSuccessor = await db.lease.count({
    where: { predecessorLeaseId: leaseId, status: { not: 'ENDED' } },
  });
  assertCondition(existingSuccessor === 0, 'This lease already has a renewal draft.', 'conflict');

  return db.lease.create({
    data: {
      ownerUserId,
      unitId: lease.unitId,
      tenantId: lease.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      rentAmountCents: input.rentAmountCents,
      depositAmountCents: input.depositAmountCents,
      dueDay: input.dueDay,
      status: 'DRAFT',
      predecessorLeaseId: leaseId,
    },
  });
}

export async function terminateLease(
  db: ScopedDb,
  ownerUserId: string,
  leaseId: string,
  input: { endDate: Date; reason: string },
) {
  assertCondition(input.reason.trim().length > 0, 'A termination reason is required.');
  await db.$transaction(async (tx) => {
    const lease = assertFound(
      await tx.lease.findFirst({ where: { id: leaseId, ownerUserId } }),
      'Lease not found.',
    );
    assertCondition(
      lease.status === 'ACTIVE',
      'Only an active lease can be terminated.',
      'invalid_state',
    );
    assertCondition(
      input.endDate.getTime() >= lease.startDate.getTime(),
      'The end date cannot be before the lease start date.',
    );

    await tx.lease.updateMany({
      where: { id: leaseId, ownerUserId, status: 'ACTIVE' },
      data: {
        status: 'ENDED',
        endDate: input.endDate,
        terminationReason: input.reason.trim(),
      },
    });

    const otherActive = await tx.lease.count({
      where: { ownerUserId, unitId: lease.unitId, status: 'ACTIVE', id: { not: leaseId } },
    });
    if (otherActive === 0) {
      await tx.unit.updateMany({
        where: { id: lease.unitId, ownerUserId },
        data: { status: 'AVAILABLE' },
      });
    }
  });
}
