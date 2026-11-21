import type { ScopedDb } from '@/lib/db/scoped';
import { DomainError, assertCondition, assertFound } from '@/lib/domain/errors';
import { isUniqueError } from '@/lib/domain/properties';

export type TenantInput = {
  name: string;
  email: string;
  phone?: string | null;
};

export async function listTenants(
  db: ScopedDb,
  options: { search?: string; portalStatus?: 'active' | 'inactive'; includeArchived?: boolean } = {},
) {
  const search = options.search?.trim();
  return db.tenant.findMany({
    where: {
      ...(options.includeArchived ? {} : { status: 'ACTIVE' }),
      ...(options.portalStatus === 'active' ? { portalUserId: { not: null } } : {}),
      ...(options.portalStatus === 'inactive' ? { portalUserId: null } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { leases: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getTenant(db: ScopedDb, tenantId: string) {
  return db.tenant.findFirst({
    where: { id: tenantId },
    include: {
      leases: {
        include: { unit: { include: { property: true } } },
        orderBy: { startDate: 'desc' },
      },
    },
  });
}

export async function createTenant(db: ScopedDb, organizationId: string, input: TenantInput) {
  const email = input.email.trim().toLowerCase();
  assertCondition(input.name.trim().length > 0, 'Tenant name is required.');
  assertCondition(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'Enter a valid email address.');

  try {
    return await db.tenant.create({
      data: {
        organizationId,
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      throw new DomainError('A tenant with that email already exists in this organization.', 'conflict');
    }
    throw error;
  }
}

export async function updateTenant(db: ScopedDb, tenantId: string, input: TenantInput) {
  const tenant = assertFound(await db.tenant.findFirst({ where: { id: tenantId } }), 'Tenant not found.');
  assertCondition(tenant.status === 'ACTIVE', 'Archived tenants cannot be edited.', 'invalid_state');
  const email = input.email.trim().toLowerCase();
  try {
    const result = await db.tenant.updateMany({
      where: { id: tenantId },
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
      },
    });
    assertCondition(result.count === 1, 'Tenant not found.', 'not_found');
  } catch (error) {
    if (isUniqueError(error)) {
      throw new DomainError('A tenant with that email already exists in this organization.', 'conflict');
    }
    throw error;
  }
}

export async function archiveTenant(db: ScopedDb, tenantId: string) {
  const activeLeases = await db.lease.count({ where: { tenantId, status: 'ACTIVE' } });
  assertCondition(activeLeases === 0, 'End the active lease before archiving this tenant.', 'invalid_state');
  const result = await db.tenant.updateMany({
    where: { id: tenantId, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });
  assertCondition(result.count === 1, 'Tenant not found or already archived.', 'not_found');
}

export async function deleteTenant(db: ScopedDb, tenantId: string) {
  const leaseCount = await db.lease.count({ where: { tenantId } });
  assertCondition(
    leaseCount === 0,
    'A tenant with lease history cannot be deleted. Archive the tenant instead.',
    'invalid_state',
  );
  const result = await db.tenant.deleteMany({ where: { id: tenantId } });
  assertCondition(result.count === 1, 'Tenant not found.', 'not_found');
}

export async function getTenantLeaseHistory(db: ScopedDb, tenantId: string) {
  return db.lease.findMany({
    where: { tenantId },
    include: { unit: { include: { property: true } } },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });
}
