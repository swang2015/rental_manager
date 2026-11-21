# Design

## Context

See `proposal.md` — Why. This is a greenfield repository containing only `openspec/`, so there is no legacy schema or code to preserve. The design must support a multi-tenant SaaS with two very different audiences (managers and tenants), strict organization isolation, and an implementation small enough for one team to ship. The repository is not yet a Git repo and has no application code.

## Goals / Non-Goals

**Goals:**

- One deployable Next.js application with server-rendered manager and tenant surfaces.
- Organization isolation enforced in one data-access layer and covered by tests, not re-implemented per page.
- Billing and occupancy behavior that is correct without a job scheduler: idempotent charge generation and read-time overdue detection.
- Local development that starts with a single database and one command.

**Non-Goals:**

- Online payment collection, card storage, or accounting exports.
- Transactional email/SMS delivery in the first release; invitation and reset links are shown to managers to share.
- Background workers, event buses, or real-time updates.
- Horizontal sharding or per-organization database provisioning.
- File uploads beyond storing a lease document URL.

## Decisions

### 1. Next.js App Router with server components and server actions

Use Next.js (App Router) with TypeScript and Tailwind CSS. Pages are server components that read through the scoped data layer; mutations are server actions validated with Zod. Route handlers are reserved for scheduled charge generation and future integrations.

- **Why:** one runtime and one language for UI, authorization, and data access; server components keep tenant data out of client bundles by default.
- **Alternatives:** separate React SPA + API (more moving parts, duplicated auth handling); Remix (viable, but the team chose Next.js).

Route structure uses role-based groups: `(auth)` for sign-in and invitation acceptance, `(manager)` for the manager workspace, and `(portal)` for tenant pages. Each layout resolves the session and rejects the wrong principal type before rendering.

### 2. PostgreSQL + Prisma, with app-level tenant scoping

Use PostgreSQL with Prisma. Every organization-owned table carries `organization_id`. All reads and writes go through a `scopedDb(orgId)` helper that injects the organization filter; pages and actions never receive a raw Prisma client. Composite indexes on `(organization_id, ...)` support the common lists. A partial unique index enforces one active lease per unit.

- **Why:** a single choke point is testable and avoids scattering `where organizationId` across the codebase. Partial unique indexes are not expressible in the Prisma schema, so they live in a hand-written migration.
- **Alternatives:** Postgres Row-Level Security is stronger but requires `SET LOCAL` per transaction, a non-superuser role, and connection-pool care; defer as defense in depth. Separate schema per tenant is operationally heavy for a small team.

### 3. Self-hosted authentication with custom database sessions

Use a small in-house session layer instead of an auth framework. Sign-in verifies an Argon2id password hash and creates a random 256-bit token; only its SHA-256 hash is stored in `sessions.token_hash`, and the raw token is delivered in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie named `rm_session`. Sessions expire after 30 days and are deleted on sign-out. Managers and tenants share one user table; the principal type is derived from membership and tenant linkage.

- **Why:** no per-seat vendor cost, full control of invitation and tenant linking, sessions can be revoked server-side, and the credential flow is a few dozen lines that fit the invitation model directly. Auth.js was the initial plan, but its adapter and callbacks added indirection without adding capability for a single-credential app.
- **Alternatives:** Auth.js with the Prisma adapter (more configuration for the same result); Clerk/Auth0 are faster to start but add cost and make tenant linkage and data residency less direct.

Authorization uses a small capability map (`owner`, `property_manager`, `staff`, `tenant`) plus `requireManager(...)` / `requireTenant()` guards in every action. UI hiding is never the control; the server re-checks on each request.

### 4. Data model

Core tables (all with `id`, `organization_id` where applicable, and `created_at`/`updated_at`):

- `organizations` (`name`, `slug`, `timezone`)
- `users` (`email` unique, `password_hash`, `name`)
- `memberships` (`organization_id`, `user_id`, `role`, `status`; unique on org+user)
- `sessions` (`token_hash` unique, `user_id`, `expires_at`)
- `invitations` (`organization_id`, `email`, `kind`, `role` nullable, `tenant_id` nullable, `token_hash`, `expires_at`, `accepted_at`, `invited_by`) 
- `tenants` (`organization_id`, `name`, `email`, `phone`, `portal_user_id` nullable, `status`; unique on org+email)
- `properties` (`name`, address fields, `notes`, `archived_at`)
- `units` (`property_id`, `label`, `bedrooms`, `bathrooms`, `rent_amount_cents`, `status`, `archived_at`; unique on property+label)
- `leases` (`unit_id`, `tenant_id`, `start_date`, `end_date`, `rent_amount_cents`, `deposit_amount_cents`, `due_day`, `status`, `termination_reason`, `predecessor_lease_id`)
- `rent_charges` (`lease_id`, `period_start`, `due_date`, `amount_cents`, `balance_cents`; unique on lease+period)
- `payments` (`charge_id`, `amount_cents`, `paid_on`, `method`, `reference`, `recorded_by`)
- `adjustments` (`charge_id`, `amount_cents`, `reason`, `created_by`)
- `maintenance_requests` (`unit_id`, `tenant_id`, `category`, `description`, `priority`, `status`, `cancelled_reason`)
- `work_orders` (`request_id` unique, `assignee_membership_id`, `scheduled_for`, `status`, `resolution_note`, `closed_at`)
- `work_order_events` (`work_order_id`, `from_status`, `to_status`, `note`, `actor_user_id`)

Money is stored as integer cents, never floats. Calendar dates use `date` columns; timestamps use `timestamptz` in UTC. Due dates are computed in the organization's configured timezone.

### 5. Idempotent billing without a scheduler

`ensureChargesForPeriod(orgId, month)` creates one charge per active lease for the period, using a unique `(lease_id, period_start)` constraint plus an upsert so repeated runs are harmless. It is invoked from the manager's rent page and from a protected cron route; missing a cron run only delays charge creation, it does not duplicate or lose money.

Charge status is derived at read time: `paid` when balance is zero, `partial` when some payment or adjustment exists, `overdue` when balance is positive and `due_date < today`, otherwise `unpaid`. `balance_cents` is updated transactionally with each payment or adjustment, and every payment is rejected when it exceeds the remaining balance.

- **Why:** no worker infrastructure, and correctness does not depend on jobs firing on time.
- **Alternatives:** storing a status column and flipping it with a nightly job adds a failure mode and drift.

### 6. Dashboard and list queries

Dashboard figures are computed per request from indexed aggregate queries (`groupBy`/SQL) scoped by organization and optional property, wrapped in React `cache` for the request. No materialized views at MVP scale.

### 7. Testing and delivery

- Domain unit tests (Vitest) for billing math, status transitions, and permission checks.
- Integration tests against a disposable Postgres for tenant isolation: every scoped repository function is exercised with a foreign organization id and must return nothing.
- Playwright smoke flows: manager onboarding, lease activation, payment recording, tenant request submission.
- Deployment: Vercel for the app, managed Postgres (Neon/Supabase) with `prisma migrate deploy`, daily backups, and preview environments with seeded demo data.

## Risks / Trade-offs

- **Missed organization filter in a new query** → all access goes through `scopedDb`; a lint rule forbids importing the raw client outside the data layer; isolation tests run in CI; RLS remains a later hardening step.
- **Partial unique index lives outside the Prisma schema** → keep it in a checked-in raw migration and add an integration test that attempts two active leases for one unit.
- **Derived overdue status and timezones** → compute "today" in the organization's timezone and test around midnight boundaries.
- **Overpayment rejection conflicts with real-world prepayment** → MVP rejects overpayment; a tenant credit ledger is a later change, and specs already define rejection.
- **No transactional email** → invitation and reset links are displayed for managers to copy; adding a provider later does not change the specs.
- **Credentials auth carries security burden** → Argon2id, login rate limiting, generic error messages, and session revocation are required tasks.

## Migration Plan

Greenfield, so there is no data migration. Create the initial Prisma migration and seed script in the first implementation task, run `prisma migrate deploy` in each environment, and seed a demo organization for previews. Rollback in development is dropping and recreating the database; production rollback uses the platform's database restore point before reverting the deploy.

## Open Questions

- Which transactional email provider to adopt when invitations should be emailed automatically (does not affect specs).
- Whether to add Postgres RLS as defense in depth after the first release (does not change behavior).
- Whether future online payments should create payment records through a webhook or a manual reconciliation view (out of scope now).
