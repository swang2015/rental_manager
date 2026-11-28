import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "WorkOrderEvent", "RequestEvent", "WorkOrder", "MaintenanceRequest", "Adjustment", "Payment", "RentCharge", "Lease", "Unit", "Property", "Invitation", "Vendor", "Tenant", "UserRole", "Session", "User" CASCADE`,
  );
}

export async function createUser(email: string, name = 'Test User') {
  return prisma.user.create({
    data: { email, name, passwordHash: await hashPassword('password123'), status: 'ACTIVE' },
  });
}

export async function createOwner(name = 'Test Owner', timezone = 'UTC') {
  return prisma.user.create({
    data: {
      email: `owner-${randomUUID().slice(0, 8)}@example.test`,
      name,
      passwordHash: await hashPassword('password123'),
      timezone,
      status: 'ACTIVE',
      roles: { create: { role: 'OWNER' } },
    },
  });
}

export async function createProperty(ownerUserId: string, name = 'Test Property') {
  return prisma.property.create({
    data: {
      ownerUserId,
      name,
      addressLine1: '1 Test Street',
      city: 'Testville',
      region: 'TS',
      postalCode: '00000',
    },
  });
}

export async function createUnit(
  ownerUserId: string,
  propertyId: string,
  label = '1A',
  rentAmountCents = 100_000,
) {
  return prisma.unit.create({
    data: {
      ownerUserId,
      propertyId,
      label,
      bedrooms: 2,
      bathrooms: 1,
      rentAmountCents,
      status: 'AVAILABLE',
    },
  });
}

export async function createTenant(
  ownerUserId: string,
  email = `tenant-${randomUUID().slice(0, 8)}@example.test`,
  name = 'Test Tenant',
) {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword('password123'),
      status: 'ACTIVE',
      roles: { create: { role: 'TENANT' } },
    },
  });
  return prisma.tenant.create({
    data: { ownerUserId, userId: user.id, name, email, phone: null },
  });
}

export async function createVendor(
  email = `vendor-${randomUUID().slice(0, 8)}@example.test`,
  name = 'Test Vendor',
) {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword('password123'),
      status: 'ACTIVE',
      roles: { create: { role: 'VENDOR' } },
    },
  });
  return prisma.vendor.create({
    data: { userId: user.id, name, company: 'Test Co.', trade: 'Plumbing' },
  });
}

export function utcDate(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

export async function createLease(input: {
  ownerUserId: string;
  unitId: string;
  tenantId: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ENDED';
  startDate?: Date;
  endDate?: Date;
  rentAmountCents?: number;
  dueDay?: number;
}) {
  return prisma.lease.create({
    data: {
      ownerUserId: input.ownerUserId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      startDate: input.startDate ?? utcDate('2026-01-01'),
      endDate: input.endDate ?? utcDate('2026-12-31'),
      rentAmountCents: input.rentAmountCents ?? 100_000,
      depositAmountCents: input.rentAmountCents ?? 100_000,
      dueDay: input.dueDay ?? 5,
      status: input.status ?? 'ACTIVE',
    },
  });
}
