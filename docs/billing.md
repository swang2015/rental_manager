# Rent billing

Money is stored as integer **cents** (`Int` columns ending in `Cents`). Amounts are
formatted as CNY in the UI; no currency column exists in this release.

## Charges

A `RentCharge` is one month of rent for one lease:

- `periodStart` is the first day of the month, stored as UTC midnight;
- `dueDate` is `periodStart`'s month at `lease.dueDay`, clamped to the 28th so every
  month has that day;
- `amountCents` is the lease rent at generation time;
- `balanceCents` starts equal to `amountCents` and is reduced by payments and
  adjustments.

### Generation

`ensureChargesForPeriod(db, organizationId, { year, month })`:

1. Selects leases with `status = ACTIVE` that overlap the month
   (`startDate <= monthEnd && endDate >= monthStart`).
2. Inserts one charge per lease with `createMany({ skipDuplicates: true })`,
   relying on the `@@unique([leaseId, periodStart])` constraint.

Running it repeatedly creates nothing new. Ended and draft leases never generate
charges. Generation is available from **Rent → Generate charges** and from the
protected cron endpoint:

```text
GET /api/cron/generate-charges?month=YYYY-MM
Authorization: Bearer $CRON_SECRET
```

The endpoint iterates every organization and uses that organization's scoped client.

## Status

Status is derived at read time from the stored balance and due date; it is not a
stored column, so it cannot go stale:

| Status | Rule |
| --- | --- |
| `paid` | `balanceCents <= 0` |
| `overdue` | balance > 0 and the due date is before today **in the organization timezone** |
| `partial` | balance > 0, not overdue, and some amount has been paid |
| `unpaid` | balance > 0, not overdue, nothing paid |

`daysLate` is the whole-day difference between today (organization timezone) and the
due date, and is 0 unless overdue.

Examples (UTC organization):

| Due | Balance | Today | Status |
| --- | --- | --- | --- |
| 2026-06-05 | 1000.00 | 2026-06-05 | unpaid |
| 2026-06-05 | 1000.00 | 2026-06-06 | overdue (1 day late) |
| 2026-06-05 | 600.00 | 2026-06-01 | partial |
| 2026-06-05 | 0 | any date | paid |

The timezone matters: 2026-06-05 23:30 UTC is already 2026-06-06 in
`Asia/Shanghai`, so the same charge is `unpaid` in UTC and `overdue` in Shanghai.

## Payments

`recordPayment` runs in a transaction:

1. Re-reads the charge inside the organization.
2. Rejects `amount <= 0` and any payment larger than `balanceCents`.
3. Inserts a `Payment` (date, method `CASH | BANK_TRANSFER | CARD | OTHER`,
   optional reference, recording user).
4. Decrements `balanceCents` by the same amount.

Overpayment is rejected rather than turned into credit. There is no online payment
collection; managers record money they received.

## Adjustments and waivers

`recordAdjustment` follows the same pattern: reason required, amount must be
positive and no larger than the balance, then the balance is reduced. A full-balance
adjustment is a waiver. Adjustments are kept as a separate audit trail and are never
edited or deleted from the UI.

## Balances and reporting

- `paidCents = amountCents - balanceCents`.
- The ledger totals **billed**, **collected**, and **outstanding** over the rows that
  match the current filters, plus the count of overdue rows.
- Period, status, property, and tenant-name filters are applied before totals are
  computed, so totals always match the visible rows.
- The dashboard rent summary uses the same function for the selected month.

## Tenant view

`/portal/rent` shows the tenant's own charges and payment history. It is read-only:
there is no mutation path for tenants. Queries are scoped both by organization and by
the tenant id from the session.

## Tests

`tests/billing.test.ts` covers idempotent generation, ended-lease exclusion, partial
and full payments, overpayment rejection, adjustment caps, and derived overdue
status. `tests/dates.test.ts` covers due-date clamping, month boundaries, and
timezone-sensitive status.
