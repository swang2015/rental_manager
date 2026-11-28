import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import { activateLease, createDraftLease, renewLease, terminateLease } from '@/lib/domain/leases';
import { createOwner, createProperty, createTenant, createUnit, resetDb, utcDate } from './helpers';

async function fixture() {
  const org = await createOwner('Lease Org');
  const property = await createProperty(org.id);
  const unit = await createUnit(org.id, property.id, '1A', 250_000);
  const tenant = await createTenant(org.id);
  return { org, property, unit, tenant, db: scopedDb(org.id) };
}

const terms = (unitId: string, tenantId: string) => ({
  unitId,
  tenantId,
  startDate: utcDate('2026-01-01'),
  endDate: utcDate('2026-12-31'),
  rentAmountCents: 250_000,
  depositAmountCents: 250_000,
  dueDay: 5,
});

describe('lease lifecycle', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a draft without occupying the unit', async () => {
    const { org, unit, tenant, db } = await fixture();

    const lease = await createDraftLease(db, org.id, terms(unit.id, tenant.id));
    expect(lease.status).toBe('DRAFT');

    const storedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(storedUnit.status).toBe('AVAILABLE');
  });

  it('rejects invalid dates and leases on non-available units', async () => {
    const { org, unit, tenant, db } = await fixture();

    await expect(
      createDraftLease(db, org.id, {
        ...terms(unit.id, tenant.id),
        endDate: utcDate('2025-12-31'),
      }),
    ).rejects.toThrow(/end date must be after the start date/);

    await prisma.unit.update({ where: { id: unit.id }, data: { status: 'OFF_MARKET' } });
    await expect(createDraftLease(db, org.id, terms(unit.id, tenant.id))).rejects.toThrow(
      /Only an available unit/,
    );
  });

  it('activates one lease and blocks a second active lease for the same unit', async () => {
    const { org, unit, tenant, db } = await fixture();
    const first = await createDraftLease(db, org.id, terms(unit.id, tenant.id));
    const second = await createDraftLease(db, org.id, terms(unit.id, tenant.id));

    await activateLease(db, org.id, first.id);

    let storedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(storedUnit.status).toBe('OCCUPIED');

    await expect(activateLease(db, org.id, second.id)).rejects.toThrow(
      /already has an active lease/,
    );

    storedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(storedUnit.status).toBe('OCCUPIED');
    expect(await db.lease.count({ where: { unitId: unit.id, status: 'ACTIVE' } })).toBe(1);
  });

  it('enforces one active lease per unit at the database level', async () => {
    const { org, unit, tenant } = await fixture();
    const base = {
      ownerUserId: org.id,
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: utcDate('2026-01-01'),
      endDate: utcDate('2026-12-31'),
      rentAmountCents: 250_000,
      depositAmountCents: 250_000,
      dueDay: 5,
      status: 'ACTIVE' as const,
    };

    await prisma.lease.create({ data: base });
    await expect(prisma.lease.create({ data: base })).rejects.toThrow();
  });

  it('terminates a lease and releases the unit', async () => {
    const { org, unit, tenant, db } = await fixture();
    const lease = await createDraftLease(db, org.id, terms(unit.id, tenant.id));
    await activateLease(db, org.id, lease.id);

    await terminateLease(db, org.id, lease.id, {
      endDate: utcDate('2026-06-30'),
      reason: 'Tenant notice',
    });

    const storedLease = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(storedLease.status).toBe('ENDED');
    expect(storedLease.terminationReason).toBe('Tenant notice');

    const storedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(storedUnit.status).toBe('AVAILABLE');
  });

  it('renews into a draft and closes the predecessor when the successor activates', async () => {
    const { org, unit, tenant, db } = await fixture();
    const lease = await createDraftLease(db, org.id, terms(unit.id, tenant.id));
    await activateLease(db, org.id, lease.id);

    const successor = await renewLease(db, org.id, lease.id, {
      ...terms(unit.id, tenant.id),
      startDate: utcDate('2027-01-01'),
      endDate: utcDate('2027-12-31'),
    });

    expect(successor.status).toBe('DRAFT');
    expect(successor.predecessorLeaseId).toBe(lease.id);
    expect((await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } })).status).toBe(
      'ACTIVE',
    );

    await activateLease(db, org.id, successor.id);

    expect((await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } })).status).toBe(
      'ENDED',
    );
    expect((await prisma.lease.findUniqueOrThrow({ where: { id: successor.id } })).status).toBe(
      'ACTIVE',
    );
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } })).status).toBe(
      'OCCUPIED',
    );
  });

  it('does not allow a second renewal draft for the same lease', async () => {
    const { org, unit, tenant, db } = await fixture();
    const lease = await createDraftLease(db, org.id, terms(unit.id, tenant.id));
    await activateLease(db, org.id, lease.id);

    const renewalTerms = {
      ...terms(unit.id, tenant.id),
      startDate: utcDate('2027-01-01'),
      endDate: utcDate('2027-12-31'),
    };
    await renewLease(db, org.id, lease.id, renewalTerms);
    await expect(renewLease(db, org.id, lease.id, renewalTerms)).rejects.toThrow(
      /already has a renewal draft/,
    );
  });
});
