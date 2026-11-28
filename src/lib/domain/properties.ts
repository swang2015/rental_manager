import type { ScopedDb } from '@/lib/db/scoped';
import { DomainError, assertCondition, assertFound } from '@/lib/domain/errors';

export type PropertyInput = {
  name: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  notes?: string | null;
};

export type UnitInput = {
  label: string;
  bedrooms: number;
  bathrooms: number;
  rentAmountCents: number;
};

export async function listProperties(
  db: ScopedDb,
  options: { archived?: boolean; search?: string } = {},
) {
  const search = options.search?.trim();
  const properties = await db.property.findMany({
    where: {
      archivedAt: options.archived ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { addressLine1: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { postalCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { units: true } } },
    orderBy: { name: 'asc' },
  });

  const occupied = await db.unit.groupBy({
    by: ['propertyId'],
    where: { status: 'OCCUPIED', archivedAt: null },
    _count: { _all: true },
  });
  const occupiedByProperty = new Map(occupied.map((row) => [row.propertyId, row._count._all]));

  return properties.map((property) => ({
    ...property,
    occupiedUnits: occupiedByProperty.get(property.id) ?? 0,
  }));
}

export async function getProperty(db: ScopedDb, propertyId: string) {
  return db.property.findFirst({
    where: { id: propertyId },
    include: {
      units: {
        where: { archivedAt: null },
        orderBy: { label: 'asc' },
        include: {
          leases: {
            where: { status: 'ACTIVE' },
            include: { tenant: true },
            take: 1,
          },
        },
      },
    },
  });
}

export async function createProperty(db: ScopedDb, ownerUserId: string, input: PropertyInput) {
  assertCondition(input.name.trim().length > 0, 'Property name is required.');
  assertCondition(input.addressLine1.trim().length > 0, 'Street address is required.');
  return db.property.create({
    data: {
      ownerUserId,
      name: input.name.trim(),
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      region: input.region.trim(),
      postalCode: input.postalCode.trim(),
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateProperty(db: ScopedDb, propertyId: string, input: PropertyInput) {
  const property = assertFound(await getProperty(db, propertyId), 'Property not found.');
  assertCondition(
    property.archivedAt === null,
    'Archived properties cannot be edited.',
    'invalid_state',
  );
  const result = await db.property.updateMany({
    where: { id: propertyId },
    data: {
      name: input.name.trim(),
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      region: input.region.trim(),
      postalCode: input.postalCode.trim(),
      notes: input.notes?.trim() || null,
    },
  });
  assertCondition(result.count === 1, 'Property not found.', 'not_found');
}

export async function archiveProperty(db: ScopedDb, propertyId: string) {
  const activeLeases = await db.lease.count({
    where: { unit: { propertyId }, status: 'ACTIVE' },
  });
  assertCondition(
    activeLeases === 0,
    'End active leases before archiving this property.',
    'invalid_state',
  );
  const result = await db.property.updateMany({
    where: { id: propertyId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  assertCondition(result.count === 1, 'Property not found or already archived.', 'not_found');
}

export async function listUnits(
  db: ScopedDb,
  options: {
    propertyId?: string;
    status?: string;
    search?: string;
    includeArchived?: boolean;
  } = {},
) {
  const search = options.search?.trim();
  return db.unit.findMany({
    where: {
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.propertyId ? { propertyId: options.propertyId } : {}),
      ...(options.status
        ? { status: options.status as 'AVAILABLE' | 'OCCUPIED' | 'OFF_MARKET' }
        : {}),
      ...(search
        ? {
            OR: [
              { label: { contains: search, mode: 'insensitive' } },
              { property: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      property: true,
      leases: {
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        take: 1,
      },
    },
    orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
  });
}

export async function createUnit(
  db: ScopedDb,
  ownerUserId: string,
  propertyId: string,
  input: UnitInput,
) {
  const property = assertFound(await getProperty(db, propertyId), 'Property not found.');
  assertCondition(
    property.archivedAt === null,
    'Cannot add units to an archived property.',
    'invalid_state',
  );
  assertCondition(input.label.trim().length > 0, 'Unit label is required.');
  assertCondition(input.bedrooms >= 0, 'Bedrooms cannot be negative.');
  assertCondition(input.bathrooms >= 0, 'Bathrooms cannot be negative.');
  assertCondition(input.rentAmountCents > 0, 'Monthly rent must be greater than zero.');

  try {
    return await db.unit.create({
      data: {
        ownerUserId,
        propertyId,
        label: input.label.trim(),
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        rentAmountCents: input.rentAmountCents,
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      throw new DomainError('That unit label is already used in this property.', 'conflict');
    }
    throw error;
  }
}

export async function updateUnit(db: ScopedDb, unitId: string, input: UnitInput) {
  const unit = assertFound(await db.unit.findFirst({ where: { id: unitId } }), 'Unit not found.');
  assertCondition(unit.archivedAt === null, 'Archived units cannot be edited.', 'invalid_state');
  try {
    const result = await db.unit.updateMany({
      where: { id: unitId },
      data: {
        label: input.label.trim(),
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        rentAmountCents: input.rentAmountCents,
      },
    });
    assertCondition(result.count === 1, 'Unit not found.', 'not_found');
  } catch (error) {
    if (isUniqueError(error)) {
      throw new DomainError('That unit label is already used in this property.', 'conflict');
    }
    throw error;
  }
}

export async function setUnitOffMarket(db: ScopedDb, unitId: string) {
  const active = await db.lease.count({ where: { unitId, status: 'ACTIVE' } });
  assertCondition(
    active === 0,
    'A unit with an active lease cannot be marked off-market.',
    'invalid_state',
  );
  const result = await db.unit.updateMany({
    where: { id: unitId, archivedAt: null },
    data: { status: 'OFF_MARKET' },
  });
  assertCondition(result.count === 1, 'Unit not found.', 'not_found');
}

export async function setUnitAvailable(db: ScopedDb, unitId: string) {
  const active = await db.lease.count({ where: { unitId, status: 'ACTIVE' } });
  assertCondition(
    active === 0,
    'A unit with an active lease cannot be marked available.',
    'invalid_state',
  );
  const result = await db.unit.updateMany({
    where: { id: unitId, archivedAt: null },
    data: { status: 'AVAILABLE' },
  });
  assertCondition(result.count === 1, 'Unit not found.', 'not_found');
}

export async function archiveUnit(db: ScopedDb, unitId: string) {
  const active = await db.lease.count({ where: { unitId, status: 'ACTIVE' } });
  assertCondition(
    active === 0,
    'End the active lease before archiving this unit.',
    'invalid_state',
  );
  const result = await db.unit.updateMany({
    where: { id: unitId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  assertCondition(result.count === 1, 'Unit not found or already archived.', 'not_found');
}

export async function removeUnit(db: ScopedDb, unitId: string) {
  const leaseCount = await db.lease.count({ where: { unitId } });
  assertCondition(
    leaseCount === 0,
    'A unit with lease history cannot be removed. Archive it instead.',
    'invalid_state',
  );
  const result = await db.unit.deleteMany({ where: { id: unitId } });
  assertCondition(result.count === 1, 'Unit not found.', 'not_found');
}

export async function listAvailableUnits(db: ScopedDb) {
  return db.unit.findMany({
    where: { archivedAt: null, status: 'AVAILABLE', leases: { none: { status: 'ACTIVE' } } },
    include: { property: true },
    orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
  });
}

export function isUniqueError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002',
  );
}
