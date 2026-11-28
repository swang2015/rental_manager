import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Models that carry an ownerUserId. Every read/write for these models must go
 * through scopedDb(ownerUserId), which injects the owner filter.
 */
const SCOPED_MODELS = new Set([
  'Invitation',
  'Tenant',
  'Vendor',
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

const UNSAFE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

/**
 * Returns a Prisma client that refuses unscoped operations on owner-owned
 * models and automatically adds the owner filter to safe operations.
 * Use updateMany/deleteMany + findFirst instead of update/delete/findUnique.
 *
 * The return type is the base client so Prisma keeps its precise query types;
 * the query hook above injects `ownerUserId` at runtime, which is why create
 * calls also pass it explicitly.
 */
export function scopedDb(ownerUserId: string): PrismaClient {
  if (!ownerUserId) {
    throw new Error('scopedDb requires an ownerUserId');
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
            next.where = { ...((next.where as Record<string, unknown>) ?? {}), ownerUserId };
          }

          if (operation === 'create') {
            next.data = { ownerUserId, ...((next.data as Record<string, unknown>) ?? {}) };
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = Array.isArray(next.data) ? next.data : [next.data];
            next.data = rows.map((row) => ({
              ownerUserId,
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
