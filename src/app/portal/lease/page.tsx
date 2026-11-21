import { requireTenant } from '@/lib/auth/session';
import { getTenantLeases } from '@/lib/domain/portal';
import { formatDate, formatMoney } from '@/lib/domain/dates';
import {
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  Table,
} from '@/components/ui';
import { LEASE_STATUS_LABEL, leaseStatusTone } from '@/lib/labels';

export default async function PortalLeasePage() {
  const context = await requireTenant();
  const leases = await getTenantLeases(context.db, context.tenant.id);
  const active = leases.find((lease) => lease.status === 'ACTIVE') ?? null;

  return (
    <>
      <PageHeader title="Your lease" subtitle={active ? `Current tenancy in ${active.unit.property.name}` : 'Lease history'} />

      {active ? (
        <Card title="Current lease" className="mb-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Property</dt>
              <dd className="font-medium">{active.unit.property.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Unit</dt>
              <dd className="font-medium">
                {active.unit.label} · {active.unit.bedrooms} bd / {active.unit.bathrooms} ba
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Start date</dt>
              <dd>{formatDate(active.startDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">End date</dt>
              <dd>{formatDate(active.endDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Monthly rent</dt>
              <dd>{formatMoney(active.rentAmountCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Security deposit</dt>
              <dd>{formatMoney(active.depositAmountCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rent due day</dt>
              <dd>{active.dueDay} of each month</dd>
            </div>
          </dl>
        </Card>
      ) : (
        <Card className="mb-6">
          <p className="text-sm text-slate-600">No active lease right now.</p>
        </Card>
      )}

      <Card title="Lease history">
        <Table head={['Unit', 'Property', 'Period', 'Rent', 'Status']}>
          {leases.length === 0 ? (
            <EmptyRow colSpan={5}>No leases recorded.</EmptyRow>
          ) : (
            leases.map((lease) => (
              <tr key={lease.id}>
                <td className="px-2 py-2 font-medium">{lease.unit.label}</td>
                <td className="px-2 py-2 text-slate-600">{lease.unit.property.name}</td>
                <td className="px-2 py-2 text-slate-600">
                  {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                </td>
                <td className="px-2 py-2">{formatMoney(lease.rentAmountCents)}</td>
                <td className="px-2 py-2">
                  <Badge tone={leaseStatusTone(lease.status)}>
                    {LEASE_STATUS_LABEL[lease.status] ?? lease.status}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </>
  );
}
