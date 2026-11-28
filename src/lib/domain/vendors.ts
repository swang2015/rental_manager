import { prisma } from '@/lib/db';
import { assertCondition, assertFound } from '@/lib/domain/errors';

export type VendorInput = {
  name: string;
  company?: string | null;
  trade?: string | null;
  phone?: string | null;
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  plumbing: ['plumber'],
  electrical: ['electrician'],
  heating: ['hvac', 'boiler'],
  appliance: ['appliances'],
  structural: ['handyman', 'general contractor'],
  pest: ['pest control', 'exterminator'],
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Simple rule-based match between a maintenance category and a vendor trade.
 * Owners can always pick any vendor; this only decides who is suggested first.
 */
export function vendorMatchesCategory(
  vendor: { trade: string | null },
  category: string,
): boolean {
  const trade = normalize(vendor.trade);
  const wanted = normalize(category);
  if (!trade || !wanted) return false;

  const aliases = CATEGORY_ALIASES[wanted] ?? [];
  return (
    trade.includes(wanted) ||
    wanted.includes(trade) ||
    aliases.some((alias) => trade.includes(alias))
  );
}

export async function listVendors(options: { search?: string; trade?: string } = {}) {
  const search = options.search?.trim();
  return prisma.vendor.findMany({
    where: {
      status: 'ACTIVE',
      ...(options.trade ? { trade: options.trade } : {}),
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
    include: {
      user: { select: { email: true } },
      _count: { select: { workOrders: true } },
    },
    orderBy: [{ name: 'asc' }],
  });
}

/** Directory for one owner: shared vendors plus how many of *their* work orders exist. */
export async function listVendorsForOwner(
  ownerUserId: string,
  options: { search?: string; trade?: string } = {},
) {
  const search = options.search?.trim();
  return prisma.vendor.findMany({
    where: {
      status: 'ACTIVE',
      ...(options.trade ? { trade: options.trade } : {}),
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
    include: {
      user: { select: { email: true } },
      _count: { select: { workOrders: { where: { ownerUserId } } } },
    },
    orderBy: [{ name: 'asc' }],
  });
}

export async function listVendorTrades(): Promise<string[]> {
  const rows = await prisma.vendor.groupBy({
    by: ['trade'],
    where: { status: 'ACTIVE', trade: { not: null } },
    orderBy: { trade: 'asc' },
  });
  return rows.map((row) => row.trade).filter((trade): trade is string => Boolean(trade));
}

export async function getVendor(vendorId: string) {
  return prisma.vendor.findFirst({
    where: { id: vendorId },
    include: {
      user: { select: { email: true } },
      workOrders: {
        include: { request: { include: { unit: { include: { property: true } }, tenant: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function updateVendor(vendorId: string, input: VendorInput) {
  const vendor = assertFound(
    await prisma.vendor.findUnique({ where: { id: vendorId } }),
    'Vendor not found.',
  );
  assertCondition(vendor.status === 'ACTIVE', 'Archived vendors cannot be edited.', 'invalid_state');
  assertCondition(input.name.trim().length > 0, 'Vendor name is required.');

  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name: input.name.trim(),
      company: input.company?.trim() || null,
      trade: input.trade?.trim() || null,
      phone: input.phone?.trim() || null,
    },
  });
}

export async function archiveVendor(vendorId: string) {
  const openOrders = await prisma.workOrder.count({
    where: {
      vendorId,
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED'] },
    },
  });
  assertCondition(openOrders === 0, 'Close open work orders before archiving this vendor.', 'invalid_state');

  const result = await prisma.vendor.updateMany({
    where: { id: vendorId, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });
  assertCondition(result.count === 1, 'Vendor not found or already archived.', 'not_found');
}

export async function listPendingVendorInvitations() {
  return prisma.invitation.findMany({
    where: { role: 'VENDOR', acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}
