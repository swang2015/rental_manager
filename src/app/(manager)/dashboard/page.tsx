import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { parseMonthKey } from '@/lib/domain/dates';
import { monthKey } from '@/lib/domain/dates';
import { rentSummary } from '@/lib/domain/billing';
import { maintenanceSummary, occupancySummary } from '@/lib/domain/dashboard';
import { listProperties } from '@/lib/domain/properties';
import { formatMoney } from '@/lib/domain/dates';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Card,
  Field,
  PageHeader,
  Stat,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';

export default async function DashboardPage({
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
  const propertyId = searchParam(params, 'propertyId') ?? '';

  const [properties, occupancy, rent, maintenance] = await Promise.all([
    listProperties(context.db),
    occupancySummary(context.db, propertyId || undefined),
    rentSummary(context.db, context.timezone, { year, month }, propertyId || undefined),
    maintenanceSummary(context.db, now, propertyId || undefined),
  ]);

  const monthValue = monthKey(year, month);

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        subtitle={`${context.owner.name} · ${context.timezone}`}
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />
      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Billing month" className="w-44">
            <input type="month" name="month" defaultValue={monthValue} className={inputClass} />
          </Field>
          <Field label="Property" className="w-56">
            <select name="propertyId" defaultValue={propertyId} className={inputClass}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton className={secondaryButtonClass}>Apply</SubmitButton>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Occupancy
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Occupancy"
          value={`${occupancy.occupancyRate}%`}
          hint={`${occupancy.OCCUPIED} of ${occupancy.total} units`}
        />
        <Stat label="Occupied" value={occupancy.OCCUPIED} href={`/properties?status=OCCUPIED`} />
        <Stat label="Available" value={occupancy.AVAILABLE} href={`/properties?status=AVAILABLE`} />
        <Stat label="Off-market" value={occupancy.OFF_MARKET} />
        <Stat label="Total units" value={occupancy.total} href="/properties" />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Rent · {monthValue}
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Billed" value={formatMoney(rent.billedCents)} />
        <Stat label="Collected" value={formatMoney(rent.collectedCents)} />
        <Stat label="Outstanding" value={formatMoney(rent.outstandingCents)} />
        <Stat
          label="Overdue charges"
          value={rent.overdueCount}
          href={`/rent?${new URLSearchParams({ month: monthValue, status: 'overdue' }).toString()}`}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Maintenance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Open requests"
          value={maintenance.open}
          href={`/maintenance?status=OPEN${propertyId ? `&propertyId=${propertyId}` : ''}`}
        />
        <Stat
          label="Urgent"
          value={maintenance.byPriority.URGENT}
          href={`/maintenance?priority=URGENT`}
        />
        <Stat label="Medium" value={maintenance.byPriority.MEDIUM} />
        <Stat label="Unassigned" value={maintenance.unassigned} href={`/maintenance?status=OPEN`} />
        <Stat label="Older than 7 days" value={maintenance.stale} />
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Figures are scoped to your portfolio.{' '}
        <Link href={`/rent?month=${monthValue}`}>Open the rent ledger</Link> to record payments.
      </p>
    </>
  );
}
