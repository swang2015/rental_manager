# Rental Manager

A multi-tenant rental property management SaaS with two surfaces:

- **Manager workspace** — portfolio (properties and units), tenants, leases,
  rent ledger, maintenance, and the operations dashboard.
- **Tenant portal** — lease summary and history, rent and payment history,
  maintenance requests, and contact details.

Out of scope for this release: online payment collection, email/SMS delivery,
accounting reports, document e-signature, mobile apps, and a public listing site.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL 17 + Prisma 6
- Custom database sessions (Argon2id + `rm_session` cookie)
- Vitest (unit/integration) and Playwright (end-to-end)

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+ (developed against 17)

## Setup

```bash
pnpm install

createdb rental_manager
createdb rental_manager_test

cp .env.example .env        # set DATABASE_URL and CRON_SECRET
cp .env.test.example .env.test   # point DATABASE_URL at rental_manager_test

pnpm db:generate
pnpm db:migrate             # or: pnpm db:deploy on a fresh database
pnpm db:seed                # optional demo data
pnpm dev
```

Open <http://localhost:3000>.

If PostgreSQL was installed with Homebrew and is not on `PATH`:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public base URL, used for links |
| `CRON_SECRET` | Bearer token for `/api/cron/generate-charges` |
| `SESSION_COOKIE_SECURE` | Set `true` behind HTTPS so the session cookie is `Secure` |

### Demo data

`pnpm db:seed` is idempotent. All demo accounts use the password `password123`.

| Account | Role |
| --- | --- |
| `owner@sunrise.test` | Owner, Sunrise Rentals |
| `manager@sunrise.test` | Property manager, Sunrise Rentals |
| `staff@sunrise.test` | Staff, Sunrise Rentals |
| `tenant@sunrise.test` | Tenant portal, Sunrise Rentals |
| `owner@harbor.test` | Owner, Harbor Homes |
| `tenant@harbor.test` | Tenant portal, Harbor Homes |

The seed creates overdue, partially paid, and paid charges and one in-progress
maintenance request, so every screen has something to show.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit and integration tests |
| `pnpm test:e2e` | Playwright suite (resets and seeds the test database; uses your installed Google Chrome) |
| `pnpm db:migrate` | Create/apply migrations in development |
| `pnpm db:deploy` | Apply migrations in production |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:test:prepare` | Apply migrations to the test database |

## Project layout

```text
prisma/                 schema, migrations, seed
src/app/(auth)/         sign-in, sign-up, accept invitation
src/app/(manager)/      manager workspace (guarded layout)
src/app/portal/         tenant portal (guarded layout)
src/app/onboarding/     first-run organization creation
src/app/api/cron/       scheduled charge generation
src/lib/auth/           sessions, passwords, permissions, invitations, rate limit
src/lib/db/             Prisma client and scopedDb organization isolation
src/lib/domain/         business rules and queries
src/lib/labels.ts       status labels and display helpers
tests/                  Vitest suites
e2e/                    Playwright suites
docs/                   authorization, invitations, billing
```

## Key rules

- Every organization-owned query goes through `scopedDb(orgId)`. Direct
  `@/lib/db` imports outside auth/db/cron modules fail lint. See
  [docs/authorization.md](docs/authorization.md).
- Every mutation is a server action that re-checks the caller's role.
- One active lease per unit is enforced by a partial unique index, not only by
  application code.
- Charges are generated idempotently per lease per month; payment and adjustment
  amounts never exceed the outstanding balance. See [docs/billing.md](docs/billing.md).
- Invitations are links copied by the manager; no email is sent. See
  [docs/tenant-invitations.md](docs/tenant-invitations.md).

## Deployment runbook

1. Provision PostgreSQL and set `DATABASE_URL`, `APP_URL`, `CRON_SECRET`, and
   `SESSION_COOKIE_SECURE=true`.
2. Run `pnpm install --frozen-lockfile`, then `pnpm db:generate` and
   `pnpm db:deploy`.
3. Run `pnpm build` and start with `pnpm start` (or the platform's Next.js
   runner). Keep the instance behind HTTPS.
4. Schedule a daily call to the cron endpoint:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://your-host/api/cron/generate-charges?month=$(date -u +%Y-%m)"
   ```

   The endpoint is idempotent, so retries and manual reruns are safe.
5. Back up the database with `pg_dump` on a schedule and before every deploy.
6. Rollback: redeploy the previous build. Migrations are additive in this release;
   if a rollback requires reversing a migration, restore the matching backup rather
   than editing applied migration history.
7. Smoke-check after deploy: sign in as an owner, open the dashboard and rent
   ledger, sign in as a tenant, and open `/portal/rent`.

## Test coverage map

| Capability | Automated coverage |
| --- | --- |
| Organization isolation | `tests/isolation.test.ts` |
| Authentication and roles | `tests/permissions.test.ts`, `tests/rate-limit.test.ts`, `e2e/auth.spec.ts` |
| Portfolio and leases | `tests/lease.test.ts`, `e2e/manager.spec.ts` |
| Rent billing | `tests/billing.test.ts`, `tests/dates.test.ts`, `e2e/manager.spec.ts` |
| Tenant portal and maintenance | `e2e/portal.spec.ts` |
| Dashboard | `e2e/manager.spec.ts` |
| Invitations | `docs/tenant-invitations.md` (manual check), `e2e/auth.spec.ts` |
