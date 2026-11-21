import Link from 'next/link';
import { requireTenant } from '@/lib/auth/session';
import { getTenantHome } from '@/lib/domain/portal';
import { formatDate, formatMoney } from '@/lib/domain/dates';
import { Card, PageHeader, Stat, TextLink, buttonClass } from '@/components/ui';
import { CHARGE_STATUS_LABEL, chargeStatusTone } from '@/lib/labels';
import { Badge } from '@/components/ui';

export default async function PortalHomePage() {
  const context = await requireTenant();
  const home = await getTenantHome(context.db, context.tenant.id, context.organization.timezone);

  return (
    <>
      <PageHeader title={`Hello, ${context.tenant.name}`} subtitle="Your tenancy at a glance." />

      {home.activeLease ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Your unit"
            value={home.activeLease.unit.label}
            hint={home.activeLease.unit.property.name}
          />
          <Stat
            label="Lease ends"
            value={formatDate(home.activeLease.endDate)}
            hint={`Started ${formatDate(home.activeLease.startDate)}`}
          />
          <Stat
            label="Next amount due"
            value={home.nextDue ? formatMoney(home.nextDue.balanceCents) : formatMoney(0)}
            hint={home.nextDue ? `Due ${formatDate(home.nextDue.dueDate)}` : 'Nothing outstanding'}
          />
          <Stat
            label="Outstanding balance"
            value={formatMoney(home.outstanding)}
            hint={home.overdue.length > 0 ? `${home.overdue.length} overdue charge(s)` : 'Up to date'}
          />
        </div>
      ) : (
        <Card className="mb-6">
          <p className="text-sm">
            You do not have an active lease right now. Your lease history is on the{' '}
            <TextLink href="/portal/lease">lease page</TextLink>.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Open maintenance requests" actions={<Badge tone="amber">{home.openRequests} open</Badge>}>
          <p className="text-sm text-slate-600">
            Report a problem with your unit and follow its progress.
          </p>
          <p className="mt-3 flex flex-wrap gap-3">
            <Link href="/portal/maintenance" className={buttonClass}>
              Maintenance requests
            </Link>
            <Link href="/portal/rent" className="px-3 py-2 text-sm font-medium text-slate-700 underline">
              View rent history
            </Link>
          </p>
        </Card>

        <Card title="Recent charges">
          {home.leases.length === 0 ? (
            <p className="text-sm text-slate-600">No charges yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {home.overdue.slice(0, 3).map((charge) => (
                <li key={charge.id} className="flex items-center justify-between gap-3">
                  <span>
                    {charge.periodStart.toISOString().slice(0, 7)} · due {formatDate(charge.dueDate)}
                  </span>
                  <span className="flex items-center gap-2">
                    {formatMoney(charge.balanceCents)}
                    <Badge tone={chargeStatusTone(charge.status)}>{CHARGE_STATUS_LABEL[charge.status]}</Badge>
                  </span>
                </li>
              ))}
              {home.overdue.length === 0 ? (
                <li className="text-slate-600">No overdue charges. Nice.</li>
              ) : null}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link href="/portal/rent" className="font-medium text-slate-900 underline">
              Open the full rent ledger
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}
