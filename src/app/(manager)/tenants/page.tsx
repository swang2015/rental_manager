import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listTenants } from '@/lib/domain/tenants';
import { createTenantAction } from '../tenant-actions';
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

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const search = searchParam(params, 'q') ?? '';
  const portalStatus = searchParam(params, 'portal') as 'active' | 'inactive' | undefined;
  const includeArchived = searchParam(params, 'archived') === 'true';

  const tenants = await listTenants(context.db, { search, portalStatus, includeArchived });
  const canManage = context.membership.role !== 'STAFF';

  return (
    <>
      <PageHeader title="Tenants" subtitle="People who rent your units and their portal access." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-56 flex-1">
            <input name="q" defaultValue={search} placeholder="Name, email, phone" className={inputClass} />
          </Field>
          <Field label="Portal" className="w-44">
            <select name="portal" defaultValue={portalStatus ?? ''} className={inputClass}>
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="inactive">Not invited</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="archived" value="true" defaultChecked={includeArchived} />
            Include archived
          </label>
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Tenant records" className="mb-6">
        <Table head={['Name', 'Email', 'Phone', 'Portal', 'Leases', '']}>
          {tenants.length === 0 ? (
            <EmptyRow colSpan={6}>No tenants match this view.</EmptyRow>
          ) : (
            tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/tenants/${tenant.id}`}>{tenant.name}</TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">{tenant.email}</td>
                <td className="px-2 py-2 text-slate-600">{tenant.phone ?? '—'}</td>
                <td className="px-2 py-2">
                  {tenant.portalUserId ? <Badge tone="green">Active</Badge> : <Badge>Not invited</Badge>}
                </td>
                <td className="px-2 py-2">{tenant._count.leases}</td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/tenants/${tenant.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {canManage ? (
        <Card title="Add a tenant">
          <form action={createTenantAction} className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" className={inputClass} />
            </Field>
            <div className="sm:col-span-3">
              <SubmitButton className={buttonClass} pendingLabel="Adding…">
                Add tenant
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
    </>
  );
}
