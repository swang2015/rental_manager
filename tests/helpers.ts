import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "WorkOrderEvent", "WorkOrder", "RequestEvent", "MaintenanceRequest", "Adjustment", "Payment", "RentCharge", "Lease", "Unit", "Property", "Tenant", "Invitation", "Membership", "Session", "User", "Organization" CASCADE`,
  );
}

export async function createOrganization(name = 'Test Org', timezone = 'UTC') {
  return prisma.organization.create({
    data: { name, slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${randomUUID().slice(0, 8)}`, timezone },
  });
}

export async function createUser(email: string, name = 'Test User') {
  return prisma.user.create({
    data: { email, name, passwordHash: await hashPassword('password123') },
  });
}

export async function createMembership(
  organizationId: string,
  userId: string,
  role: 'OWNER' | 'PROPERTY_MANAGER' | 'STAFF' = 'OWNER',
) {
  return prisma.membership.create({
    data: { organizationId, userId, role, status: 'ACTIVE' },
  });
}

export async function createProperty(organizationId: string, name = 'Test Property') {
  return prisma.property.create({
    data: {
      organizationId,
      name,
      addressLine1: '1 Test Street',
      city: 'Testville',
      region: 'TS',
      postalCode: '00000',
    },
  });
}

export async function createUnit(
  organizationId: string,
  propertyId: string,
  label = '1A',
  rentAmountCents = 100_000,
) {
  return prisma.unit.create({
    data: {
      organizationId,
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
  organizationId: string,
  email = `tenant-${randomUUID().slice(0, 8)}@example.test`,
  name = 'Test Tenant',
) {
  return prisma.tenant.create({
    data: { organizationId, name, email, phone: null },
  });
}

export function utcDate(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

export async function createLease(input: {
  organizationId: string;
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
      organizationId: input.organizationId,
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
