import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Models that carry an organizationId. Every read/write for these models must
 * go through scopedDb(orgId), which injects the organization filter.
 */
const SCOPED_MODELS = new Set([
  'Membership',
  'Invitation',
  'Tenant',
  'Property',
  'Unit',
  'Lease',
  'RentCharge',
  'Payment',
  'Adjustment',
  'MaintenanceRequest',
  'WorkOrder',
  'WorkOrderEvent',
  'RequestEvent',
]);

const FILTER_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const UNSAFE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);

/**
 * Returns a Prisma client that refuses unscoped operations on organization-owned
 * models and automatically adds the organization filter to safe operations.
 * Use updateMany/deleteMany + findFirst instead of update/delete/findUnique.
 */
/**
 * Returns a Prisma client that refuses unscoped operations on organization-owned
 * models and automatically adds the organization filter to safe operations.
 * Use updateMany/deleteMany + findFirst instead of update/delete/findUnique.
 *
 * The return type is the base client so Prisma keeps its precise query types;
 * the query hook above injects `organizationId` at runtime, which is why
 * create calls also pass it explicitly.
 */
export function scopedDb(organizationId: string): PrismaClient {
  if (!organizationId) {
    throw new Error('scopedDb requires an organizationId');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (UNSAFE_OPERATIONS.has(operation)) {
            throw new Error(
              `Unscoped operation ${model}.${operation} is not allowed. Use findFirst/updateMany/deleteMany through scopedDb.`,
            );
          }

          const next = { ...(args as Record<string, unknown>) };

          if (FILTER_OPERATIONS.has(operation)) {
            next.where = { ...((next.where as Record<string, unknown>) ?? {}), organizationId };
          }

          if (operation === 'create') {
            next.data = { organizationId, ...((next.data as Record<string, unknown>) ?? {}) };
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = Array.isArray(next.data) ? next.data : [next.data];
            next.data = rows.map((row) => ({
              organizationId,
              ...((row as Record<string, unknown>) ?? {}),
            }));
          }

          return query(next);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export type ScopedDb = PrismaClient;
