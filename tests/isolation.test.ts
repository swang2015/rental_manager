import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import {
  createLease,
  createOrganization,
  createProperty,
  createTenant,
  createUnit,
  resetDb,
} from './helpers';

describe('organization isolation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists only the scoped organization records', async () => {
    const orgA = await createOrganization('Alpha');
    const orgB = await createOrganization('Beta');
    await createProperty(orgA.id, 'Alpha House');
    await createProperty(orgB.id, 'Beta House');

    const dbA = scopedDb(orgA.id);
    const properties = await dbA.property.findMany();

    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('Alpha House');
  });

  it('cannot read another organization record by id', async () => {
    const orgA = await createOrganization('Alpha');
    const orgB = await createOrganization('Beta');
    const betaProperty = await createProperty(orgB.id, 'Beta House');

    const dbA = scopedDb(orgA.id);
    expect(await dbA.property.findFirst({ where: { id: betaProperty.id } })).toBeNull();
    expect(await dbA.property.count({ where: { id: betaProperty.id } })).toBe(0);
  });

  it('refuses unscoped mutations on organization models', async () => {
    const orgA = await createOrganization('Alpha');
    const orgB = await createOrganization('Beta');
    const betaProperty = await createProperty(orgB.id, 'Beta House');

    const dbA = scopedDb(orgA.id);
    await expect(dbA.property.findUnique({ where: { id: betaProperty.id } })).rejects.toThrow(
      /not allowed/,
    );
    await expect(
      dbA.property.update({ where: { id: betaProperty.id }, data: { name: 'Hijacked' } }),
    ).rejects.toThrow(/not allowed/);
  });

  it('injects the organization on create', async () => {
    const orgA = await createOrganization('Alpha');
    const dbA = scopedDb(orgA.id);

    const property = await dbA.property.create({
      data: {
        organizationId: orgA.id,
        name: 'Created Through Scope',
        addressLine1: '1 Scope Way',
        city: 'Testville',
        region: 'TS',
        postalCode: '00000',
      },
    });

    expect(property.organizationId).toBe(orgA.id);
  });

  it('keeps tenant records and leases inside their organization', async () => {
    const orgA = await createOrganization('Alpha');
    const orgB = await createOrganization('Beta');

    const propertyA = await createProperty(orgA.id, 'A');
    const unitA = await createUnit(orgA.id, propertyA.id, '1A');
    const tenantA = await createTenant(orgA.id, 'a@example.test');
    await createLease({ organizationId: orgA.id, unitId: unitA.id, tenantId: tenantA.id });

    const propertyB = await createProperty(orgB.id, 'B');
    const unitB = await createUnit(orgB.id, propertyB.id, '1B');
    const tenantB = await createTenant(orgB.id, 'b@example.test');
    await createLease({ organizationId: orgB.id, unitId: unitB.id, tenantId: tenantB.id });

    const dbA = scopedDb(orgA.id);
    expect(await dbA.tenant.count()).toBe(1);
    expect(await dbA.lease.count()).toBe(1);
    expect(await dbA.lease.findMany({ where: { tenantId: tenantB.id } })).toHaveLength(0);
    expect(await dbA.rentCharge.count()).toBe(0);
  });

  it('does not leak payment records across organizations', async () => {
    const orgA = await createOrganization('Alpha');
    const orgB = await createOrganization('Beta');

    const propertyB = await createProperty(orgB.id, 'B');
    const unitB = await createUnit(orgB.id, propertyB.id, '1B');
    const tenantB = await createTenant(orgB.id, 'b@example.test');
    const leaseB = await createLease({ organizationId: orgB.id, unitId: unitB.id, tenantId: tenantB.id });

    await prisma.rentCharge.create({
      data: {
        organizationId: orgB.id,
        leaseId: leaseB.id,
        periodStart: new Date('2026-06-01T00:00:00.000Z'),
        dueDate: new Date('2026-06-05T00:00:00.000Z'),
        amountCents: 100_000,
        balanceCents: 100_000,
      },
    });

    const dbA = scopedDb(orgA.id);
    expect(await dbA.rentCharge.findMany()).toHaveLength(0);
    expect(await dbA.payment.findMany()).toHaveLength(0);
  });
});
