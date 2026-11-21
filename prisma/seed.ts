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

function monthEnd(offsetMonths: number, now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 0));
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const sunrise = await prisma.organization.upsert({
    where: { slug: 'sunrise-rentals' },
    update: {},
    create: { name: 'Sunrise Rentals', slug: 'sunrise-rentals', timezone: 'Asia/Shanghai' },
  });
  const harbor = await prisma.organization.upsert({
    where: { slug: 'harbor-homes' },
    update: {},
    create: { name: 'Harbor Homes', slug: 'harbor-homes', timezone: 'America/New_York' },
  });

  async function user(email: string, name: string) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash },
    });
  }

  async function membership(organizationId: string, userId: string, role: 'OWNER' | 'PROPERTY_MANAGER' | 'STAFF') {
    return prisma.membership.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: {},
      create: { organizationId, userId, role, status: 'ACTIVE' },
    });
  }

  const sunriseOwner = await user('owner@sunrise.test', 'Olivia Owner');
  const sunriseManager = await user('manager@sunrise.test', 'Marco Manager');
  const sunriseStaff = await user('staff@sunrise.test', 'Sam Staff');
  const aliceUser = await user('tenant@sunrise.test', 'Alice Chen');
  const harborOwner = await user('owner@harbor.test', 'Hana Owner');
  const carlaUser = await user('tenant@harbor.test', 'Carla Diaz');

  await membership(sunrise.id, sunriseOwner.id, 'OWNER');
  await membership(sunrise.id, sunriseManager.id, 'PROPERTY_MANAGER');
  const staffMembership = await membership(sunrise.id, sunriseStaff.id, 'STAFF');
  await membership(harbor.id, harborOwner.id, 'OWNER');

  async function property(organizationId: string, name: string, addressLine1: string, city: string, region: string, postalCode: string) {
    const existing = await prisma.property.findFirst({ where: { organizationId, name } });
    if (existing) return existing;
    return prisma.property.create({
      data: { organizationId, name, addressLine1, city, region, postalCode },
    });
  }

  async function unit(
    organizationId: string,
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
      create: { organizationId, propertyId, label, bedrooms, bathrooms, rentAmountCents, status },
    });
  }

  async function tenant(organizationId: string, name: string, email: string, phone: string | null, portalUserId: string | null) {
    return prisma.tenant.upsert({
      where: { organizationId_email: { organizationId, email } },
      update: {},
      create: { organizationId, name, email, phone, portalUserId },
    });
  }

  async function lease(input: {
    organizationId: string;
    unitId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    rentAmountCents: number;
    depositAmountCents: number;
    dueDay: number;
    status: 'DRAFT' | 'ACTIVE' | 'ENDED';
    terminationReason?: string;
  }) {
    const existing = await prisma.lease.findFirst({
      where: { organizationId: input.organizationId, unitId: input.unitId, startDate: input.startDate },
    });
    if (existing) return existing;
    return prisma.lease.create({ data: input });
  }

  async function charge(leaseId: string, organizationId: string, periodStart: Date, amountCents: number, balanceCents: number, dueDay: number) {
    const dueDate = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), dueDay));
    return prisma.rentCharge.upsert({
      where: { leaseId_periodStart: { leaseId, periodStart } },
      update: {},
      create: { organizationId, leaseId, periodStart, dueDate, amountCents, balanceCents },
    });
  }

  async function payment(chargeId: string, organizationId: string, amountCents: number, paidOn: Date, recordedByUserId: string, reference: string) {
    const existing = await prisma.payment.findFirst({ where: { chargeId, amountCents, paidOn } });
    if (existing) return existing;
    return prisma.payment.create({
      data: {
        organizationId,
        chargeId,
        amountCents,
        paidOn,
        method: 'BANK_TRANSFER',
        reference,
        recordedByUserId,
      },
    });
  }

  const maple = await property(sunrise.id, 'Maple Court', '12 Maple Street', 'Shanghai', 'Shanghai', '200031');
  const harborView = await property(harbor.id, 'Harbor View', '88 Bay Road', 'Boston', 'MA', '02110');

  const unit1A = await unit(sunrise.id, maple.id, '1A', 2, 1, 420_000, 'OCCUPIED');
  await unit(sunrise.id, maple.id, '1B', 1, 1, 320_000, 'AVAILABLE');
  const unit2A = await unit(sunrise.id, maple.id, '2A', 3, 2, 560_000, 'AVAILABLE');
  const unit5 = await unit(harbor.id, harborView.id, '5', 2, 1, 245_000, 'OCCUPIED');
  await unit(harbor.id, harborView.id, '6', 2, 2, 275_000, 'AVAILABLE');

  const alice = await tenant(sunrise.id, 'Alice Chen', 'tenant@sunrise.test', '+86 138 0000 0001', aliceUser.id);
  const ben = await tenant(sunrise.id, 'Ben Ortiz', 'ben@example.test', '+86 138 0000 0002', null);
  const carla = await tenant(harbor.id, 'Carla Diaz', 'tenant@harbor.test', '+1 617 555 0100', carlaUser.id);

  const activeLease = await lease({
    organizationId: sunrise.id,
    unitId: unit1A.id,
    tenantId: alice.id,
    startDate: monthStart(-6),
    endDate: monthEnd(6),
    rentAmountCents: 420_000,
    depositAmountCents: 840_000,
    dueDay: 5,
    status: 'ACTIVE',
  });

  const endedLease = await lease({
    organizationId: sunrise.id,
    unitId: unit2A.id,
    tenantId: ben.id,
    startDate: monthStart(-18),
    endDate: monthEnd(-8),
    rentAmountCents: 560_000,
    depositAmountCents: 560_000,
    dueDay: 3,
    status: 'ENDED',
    terminationReason: 'Tenant moved out',
  });

  const harborLease = await lease({
    organizationId: harbor.id,
    unitId: unit5.id,
    tenantId: carla.id,
    startDate: monthStart(-3),
    endDate: monthEnd(9),
    rentAmountCents: 245_000,
    depositAmountCents: 245_000,
    dueDay: 1,
    status: 'ACTIVE',
  });

  const overdueCharge = await charge(activeLease.id, sunrise.id, monthStart(-2), 420_000, 420_000, 5);
  const paidCharge = await charge(activeLease.id, sunrise.id, monthStart(-1), 420_000, 0, 5);
  const partialCharge = await charge(activeLease.id, sunrise.id, monthStart(0), 420_000, 320_000, 5);
  await charge(harborLease.id, harbor.id, monthStart(0), 245_000, 245_000, 1);

  await payment(paidCharge.id, sunrise.id, 420_000, monthStart(-1), sunriseManager.id, 'SEPA-1001');
  await payment(partialCharge.id, sunrise.id, 100_000, monthStart(0), sunriseManager.id, 'SEPA-1002');

  const existingRequest = await prisma.maintenanceRequest.findFirst({
    where: { organizationId: sunrise.id, description: { contains: 'kitchen tap' } },
  });
  if (!existingRequest) {
    const request = await prisma.maintenanceRequest.create({
      data: {
        organizationId: sunrise.id,
        unitId: unit1A.id,
        tenantId: alice.id,
        createdByUserId: aliceUser.id,
        category: 'Plumbing',
        description: 'The kitchen tap keeps dripping and the sink drains slowly.',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        triageNote: 'Likely a worn cartridge; check the trap too.',
      },
    });
    const workOrder = await prisma.workOrder.create({
      data: {
        organizationId: sunrise.id,
        requestId: request.id,
        assigneeMembershipId: staffMembership.id,
        scheduledFor: new Date(),
        status: 'IN_PROGRESS',
      },
    });
    await prisma.requestEvent.create({
      data: {
        organizationId: sunrise.id,
        requestId: request.id,
        fromStatus: null,
        toStatus: 'OPEN',
        note: 'Request submitted',
        actorUserId: aliceUser.id,
      },
    });
    await prisma.workOrderEvent.create({
      data: {
        organizationId: sunrise.id,
        workOrderId: workOrder.id,
        fromStatus: null,
        toStatus: 'SCHEDULED',
        note: 'Work order created and assigned',
        actorUserId: sunriseManager.id,
      },
    });
  }

  console.log('Seed complete');
  console.log(`Users: password "${PASSWORD}"`);
  console.log('  owner@sunrise.test / manager@sunrise.test / staff@sunrise.test / tenant@sunrise.test');
  console.log('  owner@harbor.test / tenant@harbor.test');
  console.log(`Organizations: ${sunrise.name}, ${harbor.name}`);
  console.log(`Leases: active=${activeLease.id}, ended=${endedLease.id}, harbor=${harborLease.id}`);
  console.log(`Charges: overdue=${overdueCharge.id}, paid=${paidCharge.id}, partial=${partialCharge.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
