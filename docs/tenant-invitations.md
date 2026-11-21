# Tenant portal invitations

Tenants sign in with an email and password, but they do not self-register. A manager
links a tenant record to a user account with an invitation.

## Manager flow

1. Open **Tenants** and select the tenant.
2. In **Portal access**, press **Create invitation**.
3. The page shows a one-time link:

   ```text
   /accept-invitation/<token>
   ```

   Copy it and send it to the tenant through your usual channel. **The app does not
   send email in this release.**
4. The link is valid for **7 days**, for the tenant's email address only, and for a
   single acceptance.

While the tenant has not accepted, the tenant detail page shows **Not invited** /
**Invitation pending**. After acceptance it shows **Active** and the linked email.

## Tenant flow

1. Open the link.
2. If no account exists for the email, choose a name and a password (at least 8
   characters) and accept.
3. If an account already exists for the email, the tenant must enter that account's
   password. This prevents someone who intercepts the link from attaching an
   existing account to a stranger's tenancy.
4. On success the tenant lands on `/portal` and the tenant record gets
   `portalUserId` set.

The invitation cannot be reused: `acceptedAt` is set in the same transaction that
creates the membership or links the tenant.

## Revoking access

On the tenant detail page, **Revoke portal access**:

- clears `Tenant.portalUserId`, so the old account can no longer see the tenancy;
- deletes any outstanding, unaccepted invitations for that tenant.

Archiving or deleting a tenant also removes portal access. A tenant with leases
cannot be hard-deleted (lease history is financial history); archive instead.

## Common failures

| Message | Cause |
| --- | --- |
| This invitation is no longer valid. | Token was already used, revoked, or never existed. |
| This invitation has expired. Ask the manager for a new one. | More than 7 days old. |
| The password does not match the existing account. | The email is registered; use its password or reset it (reset is out of scope). |
| This tenant record is already linked to another account. | Another user already accepted a portal invitation for this tenant. |
| This tenant already has portal access. | Do not invite again; revoke first. |

## Data model

`Invitation` stores `kind` (`MANAGER` or `TENANT`), `email`, `role` (manager only),
`tenantId` (tenant only), `tokenHash`, `expiresAt`, `acceptedAt`, and
`invitedByUserId`. Only the hash is stored; the link cannot be recovered from the
database.
