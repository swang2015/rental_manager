import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listCharges } from '@/lib/domain/billing';
import { parseMonthKey } from '@/lib/domain/dates';
import { formatDate, formatMoney, monthKey } from '@/lib/domain/dates';
import { listProperties } from '@/lib/domain/properties';
import { ensureChargesAction } from '../billing-actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Badge,
  Card,
  EmptyRow,
  Field,
  PageHeader,
  Stat,
  Table,
  TextLink,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { CHARGE_STATUS_LABEL, chargeStatusTone } from '@/lib/labels';

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const now = new Date();
  const monthParam =
    searchParam(params, 'month') ?? monthKey(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const { year, month } = parseMonthKey(monthParam);
  const monthValue = monthKey(year, month);
  const status = searchParam(params, 'status') ?? '';
  const propertyId = searchParam(params, 'propertyId') ?? '';
  const search = searchParam(params, 'q') ?? '';

  const [ledger, properties] = await Promise.all([
    listCharges(context.db, context.timezone, {
      year,
      month,
      status: status as '' | 'unpaid' | 'partial' | 'paid' | 'overdue',
      propertyId: propertyId || undefined,
      search,
    }),
    listProperties(context.db),
  ]);

  const canRecord = true;

  return (
    <>
      <PageHeader title="Rent ledger" subtitle={`Billing period ${monthValue}`} />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Billing month" className="w-44">
            <input type="month" name="month" defaultValue={monthValue} className={inputClass} />
          </Field>
          <Field label="Status" className="w-40">
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Property" className="w-52">
            <select name="propertyId" defaultValue={propertyId} className={inputClass}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tenant" className="w-48">
            <input
              name="q"
              defaultValue={search}
              placeholder="Tenant name"
              className={inputClass}
            />
          </Field>
          <SubmitButton className={secondaryButtonClass}>Apply</SubmitButton>
        </form>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Billed" value={formatMoney(ledger.totals.billedCents)} />
        <Stat label="Collected" value={formatMoney(ledger.totals.collectedCents)} />
        <Stat label="Outstanding" value={formatMoney(ledger.totals.outstandingCents)} />
        <Stat label="Overdue" value={ledger.totals.overdueCount} />
      </div>

      {canRecord ? (
        <Card
          title="Generate charges"
          className="mb-6"
          actions={
            <form action={ensureChargesAction} className="flex items-center gap-2">
              <input type="hidden" name="month" value={monthValue} />
              <SubmitButton className={secondaryButtonClass} pendingLabel="Generating…">
                Generate for {monthValue}
              </SubmitButton>
            </form>
          }
        >
          <p className="text-sm text-slate-600">
            Creates one charge per active lease for the selected month. Running it again is safe —
            existing charges are not duplicated.
          </p>
        </Card>
      ) : null}

      <Card title="Charges">
        <Table head={['Tenant', 'Unit', 'Due', 'Amount', 'Paid', 'Balance', 'Status', '']}>
          {ledger.rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              No charges for {monthValue}. Generate charges after activating leases.
            </EmptyRow>
          ) : (
            ledger.rows.map((charge) => (
              <tr key={charge.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/rent/${charge.id}?month=${monthValue}`}>
                    {charge.lease.tenant.name}
                  </TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {charge.lease.unit.label} · {charge.lease.unit.property.name}
                </td>
                <td className="px-2 py-2 text-slate-600">{formatDate(charge.dueDate)}</td>
                <td className="px-2 py-2">{formatMoney(charge.amountCents)}</td>
                <td className="px-2 py-2">{formatMoney(charge.paidCents)}</td>
                <td className="px-2 py-2">{formatMoney(charge.balanceCents)}</td>
                <td className="px-2 py-2">
                  <Badge tone={chargeStatusTone(charge.status)}>
                    {CHARGE_STATUS_LABEL[charge.status]}
                    {charge.status === 'overdue' ? ` · ${charge.daysLate}d` : ''}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/rent/${charge.id}?month=${monthValue}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <p className="mt-4 text-sm text-slate-500">
        Scheduler endpoint:{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5">
          GET /api/cron/generate-charges?month={monthValue}
        </code>{' '}
        with{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5">Authorization: Bearer $CRON_SECRET</code>
        .
      </p>
    </>
  );
}
