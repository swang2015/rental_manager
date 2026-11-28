import type { ScopedDb } from '@/lib/db/scoped';
import { assertCondition, assertFound } from '@/lib/domain/errors';

export type VendorInput = {
  name: string;
  company?: string | null;
  trade?: string | null;
  phone?: string | null;
};

export async function listVendors(
  db: ScopedDb,
  options: { search?: string; includeArchived?: boolean } = {},
) {
  const search = options.search?.trim();
  return db.vendor.findMany({
    where: {
      ...(options.includeArchived ? {} : { status: 'ACTIVE' }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } },
              { trade: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { workOrders: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getVendor(db: ScopedDb, vendorId: string) {
  return db.vendor.findFirst({
    where: { id: vendorId },
    include: {
      user: true,
      workOrders: {
        include: { request: { include: { unit: { include: { property: true } }, tenant: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function updateVendor(db: ScopedDb, vendorId: string, input: VendorInput) {
  const vendor = assertFound(
    await db.vendor.findFirst({ where: { id: vendorId } }),
    'Vendor not found.',
  );
  assertCondition(
    vendor.status === 'ACTIVE',
    'Archived vendors cannot be edited.',
    'invalid_state',
  );
  assertCondition(input.name.trim().length > 0, 'Vendor name is required.');

  const result = await db.vendor.updateMany({
    where: { id: vendorId },
    data: {
      name: input.name.trim(),
      company: input.company?.trim() || null,
      trade: input.trade?.trim() || null,
      phone: input.phone?.trim() || null,
    },
  });
  assertCondition(result.count === 1, 'Vendor not found.', 'not_found');
}

export async function archiveVendor(db: ScopedDb, vendorId: string) {
  const openOrders = await db.workOrder.count({
    where: {
      vendorId,
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED'] },
    },
  });
  assertCondition(
    openOrders === 0,
    'Close open work orders before archiving this vendor.',
    'invalid_state',
  );
  const result = await db.vendor.updateMany({
    where: { id: vendorId, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });
  assertCondition(result.count === 1, 'Vendor not found or already archived.', 'not_found');
}

export async function listPendingVendorInvitations(db: ScopedDb) {
  return db.invitation.findMany({
    where: { role: 'VENDOR', acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}
