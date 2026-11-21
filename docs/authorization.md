# Authorization

The app has two principals: **managers** and **tenants**. Both are rows in `User`;
what they can do is derived from their links, not from a separate account type.

## Principals

| Principal | Link | Home |
| --- | --- | --- |
| Manager | `Membership(organizationId, userId)` with `status = ACTIVE` and a role | `/dashboard` |
| Tenant | `Tenant.portalUserId = userId`, `Tenant.status = ACTIVE` | `/portal` |

A user may be a manager in one organization and a tenant in another. If both links
exist, the manager workspace wins (`homePathForUser`). The first active membership
is the current organization; a user who belongs to several organizations switches by
signing out and back in with the desired membership first (multi-organization
switching is out of scope for this release).

## Roles

Roles live in `src/lib/auth/permissions.ts`:

| Capability | OWNER | PROPERTY_MANAGER | STAFF |
| --- | --- | --- | --- |
| Manage members and invitations | ✅ | — | — |
| Portfolio: properties, units, tenants, leases | ✅ | ✅ | — |
| Record payments and adjustments | ✅ | ✅ | — |
| Maintainance triage, work orders, assignment | ✅ | ✅ | ✅ (assigned work only) |
| View dashboard, properties, tenants, leases, rent | ✅ | ✅ | ✅ (read-only) |

Enforcement happens twice:

1. **Layout/pages** call `requireManager()` or `requireManager([...roles])`. A
   disallowed role is redirected to the dashboard with an error message; a tenant
   hitting a manager route is redirected to `/portal`.
2. **Server actions** repeat the same `requireManager` call. Never rely on the UI to
   hide a control: every mutation re-checks the caller.

Tenant pages call `requireTenant()`, and all reads are filtered by the tenant id
from the session — a tenant cannot request another tenant's lease or request by
guessing an identifier.

## Organization isolation

Every organization-owned table carries `organizationId`. Data access goes through
`scopedDb(organizationId)` from `src/lib/db/scoped.ts`:

- `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `aggregate`, `groupBy`,
  `updateMany`, `deleteMany` get `organizationId` injected into `where`.
- `create` / `createMany` get `organizationId` injected into `data`.
- `findUnique`, `update`, `delete`, and `upsert` **throw**. They cannot be scoped by
  a query hook, so the codebase uses `findFirst`/`updateMany`/`deleteMany` instead.

The bare `@/lib/db` client may only be imported by:

- `src/lib/db.ts` and `src/lib/db/**`,
- `src/lib/auth/**` (session and invitation resolution happen before an
  organization is known),
- `src/app/(auth)/**`, `src/app/onboarding/**`, `src/app/api/cron/**`,
- `prisma/**`.

Anywhere else, `eslint` fails the build:

```text
'@/lib/db' import is restricted from being used. Use scopedDb(orgId) from
'@/lib/db/scoped' for organization data.
```

Example:

```ts
const { db, organizationId } = await requireManager(['OWNER', 'PROPERTY_MANAGER']);

// Safe: the hook adds organizationId to both the read and the write.
const lease = await db.lease.findFirst({ where: { id: leaseId } });
await db.lease.updateMany({
  where: { id: leaseId, organizationId },
  data: { status: 'ENDED' },
});
```

`tests/isolation.test.ts` proves that a scoped client cannot read, count, update, or
list records from another organization.

## Sessions

Sessions are database-backed and custom (no Auth.js):

- Sign-in creates a random 32-byte token. Only its SHA-256 hash is stored in
  `Session.tokenHash`; the raw token goes into the `rm_session` cookie.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, valid for 30 days, and marked
  `Secure` when `SESSION_COOKIE_SECURE=true`.
- `getSessionUser()` returns the user with active memberships and tenant records, or
  deletes the row when expired.
- Sign-out deletes the session row and the cookie, so a copied cookie stops working.
- Passwords are hashed with Argon2id (`@noble/hashes`, pure JavaScript, so it runs
  on Cloudflare Workers) and stored as PHC-encoded strings.
- Failed sign-ins are rate limited per email: 5 failures per 15 minutes.

## Tests

- `tests/permissions.test.ts` — role capability map.
- `tests/isolation.test.ts` — scopedDb filters and refuses unsafe operations.
- `tests/rate-limit.test.ts` — login throttling.
