import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/auth/password';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, maxUses: 1 }),
});
const PASSWORD = 'password123';

function monthStart(offsetMonths: number, now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
}

function dueDate(periodStart: Date, day: number): Date {
  return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), day));
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  async function user(input: {
    email: string;
    name: string;
    role?: 'OWNER' | 'TENANT' | 'VENDOR';
    isSuperAdmin?: boolean;
    timezone?: string;
    phone?: string | null;
  }) {
    const record = await prisma.user.upsert({
      where: { email: input.email },
      update: { isSuperAdmin: input.isSuperAdmin ?? false, status: 'ACTIVE' },
      create: {
        email: input.email,
        name: input.name,
        passwordHash,
        isSuperAdmin: input.isSuperAdmin ?? false,
        status: 'ACTIVE',
        timezone: input.timezone ?? 'UTC',
        phone: input.phone ?? null,
      },
    });

    if (input.role) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: record.id, role: input.role } },
        update: {},
        create: { userId: record.id, role: input.role },
      });
    }
    return record;
  }

  await user({
    email: 'admin@rental.test',
    name: 'Avery Admin',
    isSuperAdmin: true,
    timezone: 'Asia/Shanghai',
  });

  const owner = await user({
    email: 'owner@rental.test',
    name: 'Olivia Owner',
    role: 'OWNER',
    timezone: 'Asia/Shanghai',
    phone: '+86 138 0000 0001',
  });
  const tenantUser = await user({
    email: 'tenant@rental.test',
    name: 'Alice Chen',
    role: 'TENANT',
    timezone: 'Asia/Shanghai',
    phone: '+86 138 0000 0002',
  });
  const vendorUser = await user({
    email: 'vendor@rental.test',
    name: 'Vic Vendor',
    role: 'VENDOR',
    timezone: 'Asia/Shanghai',
    phone: '+86 138 0000 0003',
  });

  const tenant = await prisma.tenant.upsert({
    where: { ownerUserId_userId: { ownerUserId: owner.id, userId: tenantUser.id } },
    update: { status: 'ACTIVE' },
    create: {
      ownerUserId: owner.id,
      userId: tenantUser.id,
      name: tenantUser.name,
      email: tenantUser.email,
      phone: tenantUser.phone,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { ownerUserId_userId: { ownerUserId: owner.id, userId: vendorUser.id } },
    update: { status: 'ACTIVE' },
    create: {
      ownerUserId: owner.id,
      userId: vendorUser.id,
      name: vendorUser.name,
      company: 'Vic Plumbing Co.',
      trade: 'Plumbing',
      phone: vendorUser.phone,
    },
  });

  async function property(
    name: string,
    addressLine1: string,
    city: string,
    region: string,
    postalCode: string,
  ) {
    const existing = await prisma.property.findFirst({ where: { ownerUserId: owner.id, name } });
    if (existing) return existing;
    return prisma.property.create({
      data: { ownerUserId: owner.id, name, addressLine1, city, region, postalCode },
    });
  }

  const maple = await property('Maple Court', '12 Maple Street', 'Shanghai', 'Shanghai', '200031');
  const harbor = await property(
    'Harbor View',
    '88 Riverside Road',
    'Shanghai',
    'Shanghai',
    '200040',
  );

  async function unit(
    propertyId: string,
    label: string,
    bedrooms: number,
    bathrooms: number,
    rentAmountCents: number,
    status: 'AVAILABLE' | 'OCCUPIED' | 'OFF_MARKET',
  ) {
    return prisma.unit.upsert({
      where: { propertyId_label: { propertyId, label } },
      update: {},
      create: {
        ownerUserId: owner.id,
        propertyId,
        label,
        bedrooms,
        bathrooms,
        rentAmountCents,
        status,
      },
    });
  }

  const unitA = await unit(maple.id, '1A', 2, 1, 320_000, 'OCCUPIED');
  await unit(maple.id, '1B', 1, 1, 240_000, 'AVAILABLE');
  await unit(harbor.id, '5C', 3, 2, 480_000, 'AVAILABLE');

  const leaseStart = monthStart(-3);
  const leaseEnd = monthStart(9);

  const existingLease = await prisma.lease.findFirst({
    where: { ownerUserId: owner.id, unitId: unitA.id, startDate: leaseStart },
  });
  const lease =
    existingLease ??
    (await prisma.lease.create({
      data: {
        ownerUserId: owner.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        startDate: leaseStart,
        endDate: leaseEnd,
        rentAmountCents: 320_000,
        depositAmountCents: 320_000,
        dueDay: 5,
        status: 'ACTIVE',
      },
    }));

  async function charge(periodStart: Date, balanceCents: number, amountCents = 320_000) {
    return prisma.rentCharge.upsert({
      where: { leaseId_periodStart: { leaseId: lease.id, periodStart } },
      update: {},
      create: {
        ownerUserId: owner.id,
        leaseId: lease.id,
        periodStart,
        dueDate: dueDate(periodStart, 5),
        amountCents,
        balanceCents,
      },
    });
  }

  const paidCharge = await charge(monthStart(-3), 0);
  const overdueCharge = await charge(monthStart(-1), 320_000);
  const partialCharge = await charge(monthStart(0), 160_000);

  async function payment(chargeId: string, amountCents: number, paidOn: Date, reference: string) {
    const existing = await prisma.payment.findFirst({ where: { chargeId, reference } });
    if (existing) return;
    await prisma.payment.create({
      data: {
        ownerUserId: owner.id,
        chargeId,
        amountCents,
        paidOn,
        method: 'BANK_TRANSFER',
        reference,
        recordedByUserId: owner.id,
      },
    });
  }

  await payment(paidCharge.id, 320_000, monthStart(-3), 'SEED-PAID');
  await payment(partialCharge.id, 160_000, new Date(), 'SEED-PARTIAL');

  let request = await prisma.maintenanceRequest.findFirst({
    where: { ownerUserId: owner.id, unitId: unitA.id, category: 'Plumbing' },
  });
  if (!request) {
    request = await prisma.maintenanceRequest.create({
      data: {
        ownerUserId: owner.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        category: 'Plumbing',
        description: 'Kitchen sink drains slowly and the tap drips overnight.',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        triageNote: 'Tenant available after 6pm.',
        createdByUserId: tenantUser.id,
      },
    });
    await prisma.requestEvent.create({
      data: {
        ownerUserId: owner.id,
        requestId: request.id,
        fromStatus: null,
        toStatus: 'IN_PROGRESS',
        note: 'Work order assigned to Vic Plumbing Co.',
        actorUserId: owner.id,
      },
    });
  }

  const existingOrder = await prisma.workOrder.findUnique({ where: { requestId: request.id } });
  if (!existingOrder) {
    const workOrder = await prisma.workOrder.create({
      data: {
        ownerUserId: owner.id,
        requestId: request.id,
        vendorId: vendor.id,
        scheduledFor: monthStart(0),
        status: 'SCHEDULED',
      },
    });
    await prisma.workOrderEvent.create({
      data: {
        ownerUserId: owner.id,
        workOrderId: workOrder.id,
        fromStatus: null,
        toStatus: 'SCHEDULED',
        note: 'Work order created and assigned',
        actorUserId: owner.id,
      },
    });
  }

  console.log('Seed complete');
  console.log(`Users: password "${PASSWORD}"`);
  console.log('  admin@rental.test   (platform administrator)');
  console.log('  owner@rental.test   (owner, Maple Court + Harbor View)');
  console.log('  tenant@rental.test  (tenant, 1A)');
  console.log('  vendor@rental.test  (vendor, Vic Plumbing Co.)');
  console.log(`Owner: ${owner.email}`);
  console.log(`Lease: ${lease.id}`);
  console.log(
    `Charges: paid=${paidCharge.id}, overdue=${overdueCharge.id}, partial=${partialCharge.id}`,
  );
  if (request) console.log(`Maintenance request: ${request.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
