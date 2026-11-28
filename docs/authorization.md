# Authorization

The platform has one account table (`User`) and four capabilities. A user can hold
several roles at once.

## Roles

| Role                   | Stored as                                     | Home         |
| ---------------------- | --------------------------------------------- | ------------ |
| Platform administrator | `User.isSuperAdmin = true`                    | `/admin`     |
| Owner                  | `UserRole(role = OWNER)`                      | `/dashboard` |
| Tenant                 | `UserRole(role = TENANT)` + a `Tenant` record | `/portal`    |
| Vendor                 | `UserRole(role = VENDOR)` + a `Vendor` record | `/vendor`    |

An account can be an owner and a tenant and a vendor at the same time. The header of
each workspace links to the other portals the account can access. `homePathForUser`
picks the first available surface in this order: superadmin, owner, vendor, tenant,
then `/onboarding` (pending approval or waiting for an owner invitation).

Owners are platform-level. A property belongs to exactly one owner through
`Property.ownerUserId`; there is no organization or membership layer.

## Ownership isolation

Every owner-owned table carries `ownerUserId` (properties, units, leases, charges,
payments, adjustments, maintenance, work orders, tenants, vendors, invitations).
Data access goes through `scopedDb(ownerUserId)` from `src/lib/db/scoped.ts`:

- `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `aggregate`, `groupBy`,
  `updateMany`, `deleteMany` get `ownerUserId` injected into `where`.
- `create` / `createMany` get `ownerUserId` injected into `data`.
- `findUnique`, `update`, `delete`, and `upsert` **throw**. They cannot be scoped by
  a query hook, so the codebase uses `findFirst`/`updateMany`/`deleteMany` instead.

The bare `@/lib/db` client may only be imported by:

- `src/lib/db.ts` and `src/lib/db/**`,
- `src/lib/auth/**` (session and invitation resolution happen before an owner is
  known),
- `src/app/(auth)/**`, `src/app/onboarding/**`, `src/app/admin/**`,
  `src/app/api/cron/**`,
- `src/lib/domain/vendor-portal.ts` (queries are filtered by the signed-in vendor's
  `Vendor.userId`),
- `prisma/**`.

`tests/isolation.test.ts` proves that a scoped client cannot read, count, update, or
list records from another owner.

## Guard functions

- `requireManager()` — owner workspace. Owners get `scopedDb(user.id)`. A superadmin
  gets the owner selected by the `rm_owner` cookie (set from `/admin`) or the first
  owner in the system.
- `requireTenant()` — tenant portal. Uses the first active `Tenant` record of the
  signed-in user and scopes the client to that owner.
- `requireVendor()` — vendor portal. Returns all `Vendor` records of the signed-in
  user; work-order queries are filtered by those vendor ids.
- `requireSuperAdmin()` — platform console. Owners, tenants, and vendors are
  redirected to their own home.

Every page layout and every server action calls the appropriate guard. A mutation
never relies on the UI hiding a control.

## Sessions

Sessions are database-backed and custom (no Auth.js):

- Sign-in creates a random 32-byte token. Only its SHA-256 hash is stored in
  `Session.tokenHash`; the raw token goes into the `rm_session` cookie.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, valid for 30 days, and marked
  `Secure` when `SESSION_COOKIE_SECURE=true`.
- `getSessionUser()` returns the user with roles, tenant records, and vendor records.
  Disabled accounts and expired sessions get no user.
- Sign-out deletes the session row, the cookie, and the superadmin's `rm_owner`
  selection.
- Pending accounts can sign in but only reach `/onboarding` until approved.
- Passwords are hashed with Argon2id (`@noble/hashes`, pure JavaScript, so it runs
  on Cloudflare Workers) and stored as PHC-encoded strings.
- Failed sign-ins are rate limited per email: 5 failures per 15 minutes.

## Tests

- `tests/isolation.test.ts` — scopedDb filters and refuses unsafe operations.
- `tests/rate-limit.test.ts` — login throttling.
- `e2e/auth.spec.ts` — owner, tenant, vendor, superadmin, approval, invitations.
