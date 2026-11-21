import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listLeases } from '@/lib/domain/leases';
import { listAvailableUnits, listProperties } from '@/lib/domain/properties';
import { listTenants } from '@/lib/domain/tenants';
import { formatDate } from '@/lib/domain/dates';
import { createLeaseAction } from '../lease-actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Badge,
  Card,
  EmptyRow,
  Field,
  PageHeader,
  Table,
  TextLink,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { LEASE_STATUS_LABEL, leaseStatusTone } from '@/lib/labels';

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const status = searchParam(params, 'status') ?? '';
  const propertyId = searchParam(params, 'propertyId') ?? '';
  const search = searchParam(params, 'q') ?? '';
  const presetTenantId = searchParam(params, 'tenantId') ?? '';

  const [leases, properties, units, tenants] = await Promise.all([
    listLeases(context.db, { status, propertyId, search }),
    listProperties(context.db),
    listAvailableUnits(context.db),
    listTenants(context.db),
  ]);
  const canManage = context.membership.role !== 'STAFF';

  return (
    <>
      <PageHeader title="Leases" subtitle="Draft, activate, renew, and terminate tenancies." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-48 flex-1">
            <input name="q" defaultValue={search} placeholder="Tenant, unit, property" className={inputClass} />
          </Field>
          <Field label="Status" className="w-40">
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Any</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ENDED">Ended</option>
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
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Leases" className="mb-6">
        <Table head={['Tenant', 'Unit', 'Period', 'Rent', 'Deposit', 'Status', '']}>
          {leases.length === 0 ? (
            <EmptyRow colSpan={7}>No leases match this view.</EmptyRow>
          ) : (
            leases.map((lease) => (
              <tr key={lease.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/leases/${lease.id}`}>{lease.tenant.name}</TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {lease.unit.label} · {lease.unit.property.name}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                </td>
                <td className="px-2 py-2">{(lease.rentAmountCents / 100).toFixed(2)}</td>
                <td className="px-2 py-2">{(lease.depositAmountCents / 100).toFixed(2)}</td>
                <td className="px-2 py-2">
                  <Badge tone={leaseStatusTone(lease.status)}>
                    {LEASE_STATUS_LABEL[lease.status] ?? lease.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/leases/${lease.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {canManage ? (
        <Card title="Create a draft lease">
          {units.length === 0 || tenants.length === 0 ? (
            <p className="text-sm text-slate-600">
              Add an <TextLink href="/properties">available unit</TextLink> and a{' '}
              <TextLink href="/tenants">tenant</TextLink> before creating a lease.
            </p>
          ) : (
            <form action={createLeaseAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Unit">
                <select name="unitId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Select an available unit
                  </option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property.name} · {unit.label} · {(unit.rentAmountCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tenant">
                <select name="tenantId" required className={inputClass} defaultValue={presetTenantId}>
                  <option value="" disabled>
                    Select a tenant
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.email})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Monthly rent">
                <input name="rentAmount" required placeholder="3200.00" className={inputClass} />
              </Field>
              <Field label="Start date">
                <input name="startDate" type="date" required className={inputClass} />
              </Field>
              <Field label="End date">
                <input name="endDate" type="date" required className={inputClass} />
              </Field>
              <Field label="Rent due day" hint="1–28">
                <input name="dueDay" type="number" min="1" max="28" defaultValue={5} required className={inputClass} />
              </Field>
              <Field label="Security deposit">
                <input name="depositAmount" required placeholder="3200.00" className={inputClass} />
              </Field>
              <div className="flex items-end">
                <SubmitButton className={buttonClass} pendingLabel="Creating…">
                  Create draft
                </SubmitButton>
              </div>
            </form>
          )}
        </Card>
      ) : null}
    </>
  );
}
