import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getTenant } from '@/lib/domain/tenants';
import { formatDate } from '@/lib/domain/dates';
import {
  archiveTenantAction,
  deleteTenantAction,
  inviteTenantAction,
  revokeTenantAccessAction,
  updateTenantAction,
} from '../../tenant-actions';
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

  const canManage = context.membership.role !== 'STAFF';
  const invitePath = searchParam(query, 'invite');

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
      {invitePath ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Share this invitation link: <code>{invitePath}</code>
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Portal access" className="lg:col-span-1">
          <p className="mb-3 text-sm">
            {tenant.portalUserId ? (
              <Badge tone="green">Active portal account</Badge>
            ) : (
              <Badge>No portal account</Badge>
            )}
          </p>
          {canManage ? (
            tenant.portalUserId ? (
              <form action={revokeTenantAccessAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <SubmitButton
                  className="text-sm text-rose-700 underline"
                  confirm="Revoke portal access for this tenant?"
                >
                  Revoke access
                </SubmitButton>
              </form>
            ) : (
              <form action={inviteTenantAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <SubmitButton className={secondaryButtonClass} pendingLabel="Creating…">
                  Create invitation link
                </SubmitButton>
              </form>
            )
          ) : null}
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
          {canManage ? (
            <p className="mt-3 text-sm">
              <TextLink href={`/leases?tenantId=${tenant.id}`}>Create a lease for this tenant</TextLink>
            </p>
          ) : null}
        </Card>
      </div>

      {canManage ? (
        <Card title="Tenant details">
          <form action={updateTenantAction} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <Field label="Full name">
              <input name="name" defaultValue={tenant.name} required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={tenant.email} required className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={tenant.phone ?? ''} className={inputClass} />
            </Field>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
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
      ) : null}
    </>
  );
}
