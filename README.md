# RentEase

A rental property management platform that connects property owners, tenants,
and vendors:

- **Owner workspace** — portfolio (properties and units), tenants, leases, rent
  ledger, maintenance, vendors, and the operations dashboard.
- **Tenant portal** — lease summary and history, rent and payment history,
  maintenance requests, and contact details.
- **Vendor portal** — work orders assigned to the vendor, with status updates and
  a job history.

One email address can hold several roles at once (owner, tenant, and/or vendor).
There is no organization layer: each property belongs to exactly one owner, and
every owner sees only their own portfolio.

Out of scope for this release: online payment collection, email/SMS delivery,
accounting reports, document e-signature, mobile apps, and a public listing site.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL 17 + Prisma 6 (driver adapter + Hyperdrive on Cloudflare)
- Custom database sessions (Argon2id + `rm_session` cookie)
- Cloudflare Workers via `@opennextjs/cloudflare`
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

Open <http://localhost:3000>. The first account you register at `/sign-up` becomes the
platform administrator (superadmin). Later sign-ups are account requests that the
administrator approves; owners can also be invited directly. Tenants and vendors
join through links their owner sends.

If PostgreSQL was installed with Homebrew and is not on `PATH`:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
```

### Environment variables

| Variable                | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                              |
| `APP_URL`               | Public base URL, used for links                           |
| `CRON_SECRET`           | Bearer token for `/api/cron/generate-charges`             |
| `SESSION_COOKIE_SECURE` | Set `true` behind HTTPS so the session cookie is `Secure` |

### Demo data

`pnpm db:seed` is idempotent. All demo accounts use the password `password123`.

| Account              | Role                                               |
| -------------------- | -------------------------------------------------- |
| `admin@rental.test`  | Platform administrator (superadmin)                |
| `owner@rental.test`  | Owner of Maple Court and Harbor View               |
| `tenant@rental.test` | Tenant in Maple Court 1A                           |
| `vendor@rental.test` | Vendor (Vic Plumbing Co.), assigned one work order |

The seed creates overdue, partially paid, and paid charges and an in-progress
maintenance request, so every screen has something to show.

### Accounts and roles

1. The **first** account created at `/sign-up` is the **platform administrator**
   (`isSuperAdmin`).
2. After that, anyone can submit an account request at `/sign-up` (owner, tenant,
   or vendor). Requests stay `PENDING` until the administrator approves them at
   `/admin`.
3. The administrator can also generate an **owner invitation link**. Owners are
   approved immediately when they accept it.
4. Owners invite tenants from **Tenants** and vendors from **Vendors**. Invitations
   are links you copy and send — the app does not send email. Accepting adds the
   role to the account and creates the owner's tenant/vendor record.
5. A superadmin can open any owner's workspace with full permissions from
   `/admin`; the workspace header has a **Platform admin** link to switch back.
6. One email can hold multiple roles. The header links to the other portals when
   the signed-in account also has those roles.

The current release resets the old organization-based schema (see the init
migration). Existing organization data is intentionally discarded; after
deploying, the first sign-up creates the new administrator.

## Scripts

| Command                | What it does                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`             | Development server                                                                       |
| `pnpm build`           | Production build                                                                         |
| `pnpm start`           | Serve the production build                                                               |
| `pnpm typecheck`       | `tsc --noEmit`                                                                           |
| `pnpm lint`            | ESLint                                                                                   |
| `pnpm test`            | Vitest unit and integration tests                                                        |
| `pnpm test:e2e`        | Playwright suite (resets and seeds the test database; uses your installed Google Chrome) |
| `pnpm db:migrate`      | Create/apply migrations in development                                                   |
| `pnpm db:deploy`       | Apply migrations in production                                                           |
| `pnpm db:seed`         | Seed demo data                                                                           |
| `pnpm db:test:prepare` | Apply migrations to the test database                                                    |

## Project layout

```text
prisma/                 schema, migrations, seed
src/app/(auth)/         sign-in, sign-up, accept invitation
src/app/(manager)/      owner workspace (guarded layout)
src/app/portal/         tenant portal (guarded layout)
src/app/vendor/         vendor portal (guarded layout)
src/app/admin/          platform administration (superadmin only)
src/app/onboarding/     pending account / waiting-for-invite screen
src/app/api/cron/       scheduled charge generation
src/lib/auth/           sessions, passwords, invitations, rate limit
src/lib/db.ts           lazy Prisma client for Node and Workers
src/lib/db/             scopedDb owner isolation
src/lib/domain/         business rules and queries
src/lib/labels.ts       status labels and display helpers
wrangler.jsonc          Cloudflare Worker + Hyperdrive config
open-next.config.ts     OpenNext adapter config
tests/                  Vitest suites
e2e/                    Playwright suites
docs/                   authorization, invitations, billing
```

## Key rules

- Every owner-owned query goes through `scopedDb(ownerUserId)`. Direct
  `@/lib/db` imports outside auth/db/cron modules fail lint. See
  [docs/authorization.md](docs/authorization.md).
- Every mutation is a server action that re-checks the caller's role and ownership.
- One active lease per unit is enforced by a partial unique index, not only by
  application code.
- Charges are generated idempotently per lease per month; payment and adjustment
  amounts never exceed the outstanding balance. See [docs/billing.md](docs/billing.md).
- Invitations are links copied by the owner or administrator; no email is sent. See
  [docs/tenant-invitations.md](docs/tenant-invitations.md).

## Deploy to Cloudflare Workers

The app runs on Cloudflare Workers through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). PostgreSQL stays on
your existing provider; Workers reach it through
[Hyperdrive](https://developers.cloudflare.com/hyperdrive/), and Prisma uses the
`@prisma/adapter-pg` driver adapter (one client per request).

**Requirements**

- Cloudflare **Workers Paid**. Argon2id at 19 MiB / 2 iterations needs more than the
  free plan's 10 ms CPU budget. The default paid limit is 30 s per request.
- A PostgreSQL database reachable from Cloudflare (Neon, Supabase, RDS, etc.).
  Cloudflare does not host PostgreSQL.
- `wrangler` authenticated: `pnpm exec wrangler login`.

**1. Create the Hyperdrive config**

```bash
pnpm exec wrangler hyperdrive create rentease \
  --connection-string="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

Copy the printed id into `wrangler.jsonc` (`hyperdrive[0].id`), replacing
`REPLACE_WITH_HYPERDRIVE_ID`.

**2. Apply migrations to the production database**

Migrations run from your machine or CI, not from the Worker:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require" \
  pnpm db:deploy
```

Load demo data only if you want it:

```bash
DATABASE_URL="..." pnpm db:seed
```

**3. Set runtime secrets**

```bash
pnpm exec wrangler secret put CRON_SECRET
pnpm exec wrangler secret put SESSION_COOKIE_SECURE   # value: true
```

`DATABASE_URL` is **not** used in production; the Worker gets its connection string
from the `HYPERDRIVE` binding.

**4. Deploy**

```bash
pnpm deploy          # build + deploy
# or:
pnpm build:cf
pnpm exec wrangler deploy
```

Use `--keep-vars` if you manage variables in the dashboard and don't want a deploy
to remove them: `pnpm exec opennextjs-cloudflare deploy -- --keep-vars`.

**Local preview in the Workers runtime**

```bash
cp .dev.vars.example .dev.vars   # set your local connection string
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://USER:PASSWORD@localhost:5432/rental_manager?schema=public"
pnpm preview
# http://localhost:8787
```

The exported variable is needed by the OpenNext preview helper; `.dev.vars` is read by
Wrangler for the rest of the bindings. Local Postgres must accept the username/password
(Homebrew's default trust auth ignores the password, but Wrangler requires one in the
URL).

**Scheduled charge generation**

The worker has no `scheduled` handler. Add a tiny separate Worker with a Cron Trigger
that calls the endpoint, or use any external scheduler:

```ts
export default {
  async scheduled(_event, env, ctx) {
    const month = new Date().toISOString().slice(0, 7);
    ctx.waitUntil(
      fetch(`https://your-app.workers.dev/api/cron/generate-charges?month=${month}`, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
  },
} satisfies ExportedHandler<{ CRON_SECRET: string }>;
```

```jsonc
{ "triggers": { "crons": ["0 1 * * *"] } }
```

The endpoint is idempotent, so retries and manual reruns are safe.

**Backups and rollback**

Back up with `pg_dump` on a schedule and before every deploy. Roll back by deploying a
previous Worker version (`wrangler rollback`) or the previous build. Migrations are
additive in this release; if a rollback requires reversing one, restore the matching
database backup rather than editing applied migration history.

**Smoke-check after deploy**

Sign in as an owner, open the dashboard and rent ledger, sign in as a tenant, and open
`/portal/rent`.

### Node / container deployment (alternative)

The same build still runs on Node 20+: set `DATABASE_URL`, `APP_URL`,
`CRON_SECRET`, and `SESSION_COOKIE_SECURE=true`, then run `pnpm db:deploy`,
`pnpm build`, and `pnpm start` behind HTTPS.

## Deploy to Railway

The repository includes a `Dockerfile` and `railway.json`, so Railway builds the app
as a plain Node service. Cloudflare/Hyperdrive is not involved on this path: the app
reads `DATABASE_URL` directly, and migrations run as the pre-deploy command.

**1. Create the project**

- In Railway, **New Project → Deploy from GitHub repo** and pick `rental_manager`.
- Add a database: **New → Database → Add PostgreSQL**.

**2. Set the app service variables**

| Variable                | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`          | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `APP_URL`               | `https://<your-domain>` — set it after step 3, then redeploy  |
| `SESSION_COOKIE_SECURE` | `true`                                                        |
| `CRON_SECRET`           | long random string, e.g. `openssl rand -hex 32`               |

`railway.json` configures the rest:

- build: `Dockerfile` (`prisma generate` + `next build`)
- pre-deploy: `pnpm db:deploy`, so migrations apply before the new release starts
- start: `pnpm start`, which binds `0.0.0.0` on Railway's `PORT`
- health check: `/api/health` (returns 503 until `SELECT 1` succeeds)

**3. Generate a domain**

**Settings → Networking → Generate Domain**, then copy the URL into `APP_URL` and
redeploy. Open `https://<domain>/sign-up` to create the administrator account, then
use `/admin` to approve account requests or invite an owner. Sign in later at
`https://<domain>/sign-in`.

Demo data is optional: run `pnpm db:seed` once against the Railway database (from a
one-off shell or `DATABASE_URL=<public URL> pnpm db:seed` from your machine).

**4. Scheduled charge generation (optional)**

Create a second service from the same repository (same image; no public domain
needed), give it the same `APP_URL` and `CRON_SECRET`, and configure it as a cron
job with schedule `0 1 * * *` and command:

```bash
node scripts/generate-charges.mjs
```

The script calls `/api/cron/generate-charges` with the bearer secret and exits, so the
cron service does not run the web server. The endpoint is idempotent; reruns are safe.

**Railway CLI shortcut**

```bash
railway login
railway link                                  # select the project
railway variables --set "CRON_SECRET=$(openssl rand -hex 32)"
railway up                                    # build and deploy this directory
```

`pnpm deploy` still targets Cloudflare Workers; the Docker path is independent.

## Test coverage map

| Capability                            | Automated coverage                                                    |
| ------------------------------------- | --------------------------------------------------------------------- |
| Owner isolation                       | `tests/isolation.test.ts`                                             |
| Authentication, approval, and portals | `tests/rate-limit.test.ts`, `e2e/auth.spec.ts`                        |
| Portfolio and leases                  | `tests/lease.test.ts`, `e2e/manager.spec.ts`                          |
| Rent billing                          | `tests/billing.test.ts`, `tests/dates.test.ts`, `e2e/manager.spec.ts` |
| Tenant portal and maintenance         | `e2e/portal.spec.ts`                                                  |
| Vendor portal and work orders         | `e2e/portal.spec.ts`                                                  |
| Invitations                           | `e2e/auth.spec.ts`, `e2e/manager.spec.ts`                             |
