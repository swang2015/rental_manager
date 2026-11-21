import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@prisma/adapter-pg', 'pg'],
};

export default nextConfig;

// Bindings are only needed when emulating the Workers runtime through
// `next dev`. The normal Node path reads DATABASE_URL, so skip the wrangler
// proxy when no local Hyperdrive connection string is configured.
if (process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
  initOpenNextCloudflareForDev();
}
