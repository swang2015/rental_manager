import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cache } from 'react';

type HyperdriveEnv = { HYPERDRIVE?: { connectionString: string } };

function isCloudflareWorker(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
}

function workerConnectionString(): string {
  const { env } = getCloudflareContext();
  const connectionString = (env as HyperdriveEnv).HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error('The HYPERDRIVE binding is missing. Add it to wrangler.jsonc.');
  }
  return connectionString;
}

function createClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, maxUses: 1 }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * On Workers, Cloudflare requires a fresh client per request: a connection
 * opened during one request must not be reused by another. React's cache keeps
 * the client stable for the duration of a single server render/action.
 */
const getRequestClient = cache(() => createClient(workerConnectionString()));

let nodeClient: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (isCloudflareWorker()) return getRequestClient();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  nodeClient ??= createClient(connectionString);
  return nodeClient;
}

/**
 * Backwards-compatible accessors for code that resolves the client lazily.
 * The proxy exists so existing `prisma.model.findMany()` call sites keep
 * working while the actual client is created per request on Workers.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
