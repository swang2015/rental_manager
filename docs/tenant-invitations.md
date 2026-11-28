# Invitations and account approval

RentEase has no email delivery. Accounts enter the platform in one of two ways:

1. **Account request** — anyone can submit `/sign-up`. The account is created as
   `PENDING` with a requested role. A platform administrator approves it at
   `/admin` (and may change the role) or rejects it, which deletes the request.
2. **Invitation link** — an administrator invites owners; owners invite tenants and
   vendors. The link is copied and sent manually.

The first account ever created at `/sign-up` is different: it becomes the platform
administrator immediately and skips the approval step.

## Owner invitations (administrator)

1. Open `/admin` and enter the owner's email under **Invite a property owner**.
2. Copy the one-time link `/accept-invitation/<token>` and send it to the owner.
3. When the owner accepts, the `OWNER` role is added to their account and they land
   on `/dashboard`.

The link is valid for **7 days**, for that email only, and for a single acceptance.

## Tenant invitations (owner)

1. Open **Tenants** and enter the tenant's email under **Invite a tenant**.
2. Send the link. Once accepted, the platform adds the `TENANT` role and creates the
   owner's `Tenant` record; the tenant appears in the list and can be attached to a
   lease.
3. The tenant signs in at `/portal` and sees only their own lease, charges, and
   requests.

## Vendor invitations (administrator)

Vendors are a platform-wide directory, not an owner's private list.

1. A vendor can submit an account request at `/sign-up` (role: vendor), or the
   administrator can invite one from `/admin`.
2. Accepting adds the `VENDOR` role and creates the global `Vendor` record.
   The administrator fills in company, trade, and phone.
3. Every owner sees the same directory at **Vendors** and can pick any vendor when
   creating a work order; the vendor whose trade matches the category is suggested
   first.
4. The vendor signs in at `/vendor` and sees only work orders assigned to them. They
   can move a work order through in progress → resolved → closed and leave notes;
   the owner sees the same status changes.

## One email, several roles

Accepting an invitation only adds a role. If the email already has an account, the
invitee must enter that account's password to confirm, and the existing roles stay
in place. A person can therefore be an owner for their own property and a tenant in
someone else's at the same time; the workspace headers link between portals.

## Security notes

- Invitations are stored as SHA-256 token hashes; the raw token exists only in the
  link.
- `acceptedAt` is set in the same transaction that adds the role and creates the
  tenant/vendor record, so a link cannot be reused.
- An invitation for an existing account requires that account's password.
- Rejecting an account request only deletes users that are still `PENDING`.
- There is no password reset flow in this release; administrators should keep their
  credentials safe.

## Common failures

| Message                                           | Cause                                                          |
| ------------------------------------------------- | -------------------------------------------------------------- |
| This invitation is no longer valid.               | Token was already used or never existed.                       |
| This invitation has expired. Ask for a new one.   | More than 7 days old.                                          |
| The password does not match the existing account. | The email is registered; sign in with that account's password. |
| This account is disabled.                         | The administrator disabled the account.                        |

## Data model

`Invitation` stores `email`, `role` (`OWNER`, `TENANT`, or `VENDOR`), `ownerUserId`
(tenant invitations only), `tokenHash`, `expiresAt`, `acceptedAt`, and
`invitedByUserId`. The tenant record is created on acceptance, not when the
invitation is generated. Vendor records are global and keyed by the account.
