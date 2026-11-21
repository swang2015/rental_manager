# Tasks

## 1. Project foundation

- [x] 1.1 Scaffold a Next.js App Router project with TypeScript and Tailwind CSS, and verify `pnpm dev` serves a placeholder page
- [x] 1.2 Add typecheck, lint, and format scripts plus `.gitignore` and `.env.example`, and verify all three commands pass on the clean scaffold
- [x] 1.3 Add Vitest and Playwright configuration with one passing smoke test each, and verify `pnpm test` and `pnpm test:e2e` run
- [x] 1.4 Write the README setup section covering prerequisites, database URL, and first run, and verify the documented commands work from a clean checkout

## 2. Database and tenant isolation

- [x] 2.1 Define the Prisma schema for organizations, users, memberships, invitations, tenants, properties, units, leases, charges, payments, adjustments, maintenance requests, work orders, and work-order events, and verify `prisma validate` passes
- [x] 2.2 Create the initial migration including the one-active-lease partial unique index and `(organization_id, ...)` indexes, and verify `prisma migrate deploy` succeeds on an empty database
- [x] 2.3 Implement the `scopedDb(orgId)` data-access helper and forbid direct Prisma client imports outside it, and verify a unit test proves the organization filter is applied
- [x] 2.4 Build an idempotent seed with two organizations, managers, tenants, units, leases, charges, and requests, and verify running it twice leaves counts unchanged
- [x] 2.5 Add integration tests that call every scoped repository with a foreign organization id, and verify all return empty or deny without leaking records

## 3. Authentication and organization access

- [x] 3.1 Integrate custom database sessions with Argon2id password hashing and the `rm_session` cookie, and verify sign-in and sign-out pass an end-to-end test
- [x] 3.2 Implement the session resolver and capability map for owner, property manager, staff, and tenant, and verify unit tests cover allowed and denied actions
- [x] 3.3 Implement first-run organization onboarding that makes the creator the owner, and verify the new organization and membership are created atomically
- [x] 3.4 Implement member invitation create, accept, expire, and revoke with email matching, and verify integration tests cover each outcome
- [x] 3.5 Add login rate limiting and generic credential errors, and verify repeated failed attempts are throttled
- [x] 3.6 Build the manager layout guard and account menu showing organization and role, and verify a staff user is redirected away from member management
- [x] 3.7 Document the authorization model and scoped data-access rule in `docs/authorization.md`, and verify the examples match the implemented guards

## 4. Property and unit management

- [x] 4.1 Implement property create, read, update, archive, and active/archived lists, and verify integration tests cover validation and archive behavior
- [x] 4.2 Implement unit create, edit, and remove-or-archive with unique labels per property, and verify duplicate and lease-history tests pass
- [x] 4.3 Render unit occupancy status and property/unit counts from live data, and verify the counts change when a lease is activated or ended
- [x] 4.4 Add portfolio filters for property, occupancy status, and text search, and verify an end-to-end filter test returns the expected rows

## 5. Tenant management

- [x] 5.1 Implement tenant create, update, archive, and unique-email validation per organization, and verify integration tests cover duplicates and deletion refusal
- [x] 5.2 Implement tenant portal invitation, acceptance, account linking, and access revocation, and verify single-use and email-match tests pass
- [x] 5.3 Render tenant lease history newest-first with status, and verify a tenant with active and ended leases shows both in order
- [x] 5.4 Add tenant search by name, email, and phone plus portal-status filter, and verify a partial-email search test passes
- [x] 5.5 Document the tenant invitation handoff (copy link, expiry, revoke) in `docs/tenant-invitations.md`, and verify it matches the UI copy

## 6. Lease lifecycle

- [x] 6.1 Implement draft lease creation with unit, tenant, dates, rent, deposit, and due-day validation, and verify invalid-date and occupied-unit tests pass
- [x] 6.2 Implement lease activation that occupies the unit and enforces one active lease per unit, and verify a concurrent-activation test leaves exactly one active lease
- [x] 6.3 Implement draft editing, active lease extension, and rent changes that preserve existing charges, and verify the rent-change test passes
- [x] 6.4 Implement renewal that creates a successor draft and closes the prior lease on activation, and verify the renewal integration test passes
- [x] 6.5 Implement termination with end date and reason that releases the unit, and verify the terminated lease stays visible in history
- [x] 6.6 Verify unit status changes from every lease transition (activate, renew, terminate) through one integration test per transition

## 7. Rent billing

- [x] 7.1 Implement idempotent `ensureChargesForPeriod` and a protected cron route, and verify repeated generation creates no duplicate charges and ended leases generate none
- [x] 7.2 Implement payment recording that updates the charge balance in a transaction and rejects overpayment, and verify partial, full, and overpayment tests pass
- [x] 7.3 Implement adjustments and waivers with a reason, capped at the outstanding balance, and verify waiver and over-waiver tests pass
- [x] 7.4 Implement derived charge status (unpaid, partial, paid, overdue) using the organization timezone, and verify tests around midnight and after payment
- [x] 7.5 Build manager ledger views with period, status, property, tenant filters and billed/collected/outstanding totals, and verify totals match filtered rows
- [x] 7.6 Build the tenant read-only rent view scoped to the signed-in tenant, and verify a second tenant's charges never appear
- [x] 7.7 Document billing rules (period, due date, balance, overdue, adjustments) in `docs/billing.md`, and verify the documented examples match test fixtures

## 8. Maintenance management

- [x] 8.1 Implement the organization-scoped request queue, detail view, and manager-created requests, and verify tenant-submitted and on-behalf requests appear with correct context
- [x] 8.2 Implement triage priority and note with a medium default, and verify the tenant view reflects the new priority
- [x] 8.3 Implement work-order creation, assignment, and reassignment history, and verify staff only see assigned work and prior assignees are retained
- [x] 8.4 Implement work-order status transitions with a required resolution note and synchronization back to the request, and verify note-required and closed-final tests pass
- [x] 8.5 Implement request cancellation with a reason that closes open work, and verify the tenant sees the reason
- [x] 8.6 Add maintenance filters for property, status, priority, category, assignee, and text search, and verify an urgent-open filter test passes

## 9. Tenant portal

- [x] 9.1 Build the tenant layout guard and home summary (unit, lease period, next due, balance, open requests), and verify active-lease and ended-lease states
- [x] 9.2 Build the tenant lease detail and history pages, and verify a tenant cannot open another tenant's lease by identifier
- [x] 9.3 Build the tenant rent page with charges, payments, balance, and overdue state, and verify it offers no payment mutation
- [x] 9.4 Implement maintenance submission with category and required description for tenants with an active lease, and verify former tenants are denied
- [x] 9.5 Implement tenant request tracking with status, priority, scheduled date, resolution note, and history, and verify status edits are denied
- [x] 9.6 Implement tenant phone updates while blocking name and email changes, and verify the manager view sees the new phone

## 10. Operations dashboard

- [x] 10.1 Implement the occupancy summary (total, occupied, available, off-market, rate), and verify it updates after lease activation and termination
- [x] 10.2 Implement the rent collection summary with a month selector and billed/collected/outstanding/overdue figures, and verify switching months recalculates totals
- [x] 10.3 Implement the maintenance summary with open counts by priority and unassigned or stale counts, and verify unassigned requests are counted
- [x] 10.4 Add the property filter and drill-down links to filtered lists, and verify the overdue drill-down opens the ledger with the matching filter

## 11. Integration and delivery

- [x] 11.1 Add Playwright flows for onboarding, property and unit setup, lease activation, payment recording, and tenant request submission, and verify the suite passes against seeded data
- [x] 11.2 Run an accessibility and responsive pass on manager and portal key pages, and verify keyboard navigation and mobile layouts for the tested flows
- [x] 11.3 Write the deployment runbook (environment variables, `prisma migrate deploy`, backups, rollback), and verify a production build and migration run against a staging database
- [x] 11.4 Verify all eight capability specs are covered by at least one automated test or documented manual check, and record the mapping in the runbook

## Workflow follow-up

- Review the implemented change against the specs and design.
- Archive the change after review and verification are complete.
