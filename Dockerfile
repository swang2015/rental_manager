# syntax=docker/dockerfile:1
# Node runtime image for Railway (or any container host).
# The Cloudflare/OpenNext path is untouched: `pnpm deploy` still builds the Worker.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.34.9
WORKDIR /app

# Dependencies are installed once and reused by the build stage.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` does not connect, but the schema requires the variable to exist.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/placeholder"
RUN pnpm db:generate && pnpm build

# Runtime keeps the full dependency tree so `prisma migrate deploy` (the Railway
# pre-deploy command) has the Prisma CLI and its engines available.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "start"]
