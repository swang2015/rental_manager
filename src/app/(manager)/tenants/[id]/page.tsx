import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getTenant } from '@/lib/domain/tenants';
import { formatDate } from '@/lib/domain/dates';
import { archiveTenantAction, deleteTenantAction, updateTenantAction } from '../../tenant-actions';
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

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const query = await searchParams;
  const tenant = await getTenant(context.db, id);
  if (!tenant) notFound();

  return (
    <>
      <PageHeader
        title={tenant.name}
        subtitle={`${tenant.email}${tenant.phone ? ` · ${tenant.phone}` : ''}`}
        actions={
          <Link href="/tenants" className={secondaryButtonClass}>
            Back to tenants
          </Link>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Account" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Sign-in email</dt>
              <dd>{tenant.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Joined</dt>
              <dd>{formatDate(tenant.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge tone={tenant.status === 'ACTIVE' ? 'green' : 'gray'}>
                  {tenant.status === 'ACTIVE' ? 'Active' : 'Archived'}
                </Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            The tenant manages this account from the tenant portal. You can change their display
            name and phone here.
          </p>
        </Card>

        <Card title="Leases" className="lg:col-span-2">
          <Table head={['Unit', 'Property', 'Period', 'Rent', 'Status']}>
            {tenant.leases.length === 0 ? (
              <EmptyRow colSpan={5}>No leases yet.</EmptyRow>
            ) : (
              tenant.leases.map((lease) => (
                <tr key={lease.id}>
                  <td className="px-2 py-2">
                    <TextLink href={`/leases/${lease.id}`}>{lease.unit.label}</TextLink>
                  </td>
                  <td className="px-2 py-2 text-slate-600">{lease.unit.property.name}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                  </td>
                  <td className="px-2 py-2">{(lease.rentAmountCents / 100).toFixed(2)}</td>
                  <td className="px-2 py-2">
                    <Badge tone={leaseStatusTone(lease.status)}>
                      {LEASE_STATUS_LABEL[lease.status] ?? lease.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </Table>
          <p className="mt-3 text-sm">
            <TextLink href={`/leases?tenantId=${tenant.id}`}>
              Create a lease for this tenant
            </TextLink>
          </p>
        </Card>
      </div>

      <Card title="Tenant details">
        <form action={updateTenantAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <Field label="Display name">
            <input name="name" defaultValue={tenant.name} required className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={tenant.phone ?? ''} className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <SubmitButton className={buttonClass} pendingLabel="Saving…">
              Save tenant
            </SubmitButton>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm">
          <form action={archiveTenantAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <SubmitButton
              className="text-slate-600 underline"
              confirm="Archive this tenant? They leave the active list."
            >
              Archive tenant
            </SubmitButton>
          </form>
          <form action={deleteTenantAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <SubmitButton
              className="text-rose-700 underline"
              confirm="Delete this tenant permanently? Tenants with lease history cannot be deleted."
            >
              Delete tenant
            </SubmitButton>
          </form>
        </div>
      </Card>
    </>
  );
}
