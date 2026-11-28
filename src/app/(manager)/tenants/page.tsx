import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listTenants } from '@/lib/domain/tenants';
import { inviteTenantAction } from '../tenant-actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
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
  const includeArchived = searchParam(params, 'archived') === 'true';
  const invite = searchParam(params, 'invite');

  const [tenants, invitations] = await Promise.all([
    listTenants(context.db, { search, includeArchived }),
    context.db.invitation.findMany({
      where: { role: 'TENANT', acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="People who rent your units and can sign in to the portal."
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />
      {invite ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Share this invitation link: <code>{invite}</code>
        </p>
      ) : null}

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-56 flex-1">
            <input
              name="q"
              defaultValue={search}
              placeholder="Name, email, phone"
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="archived" value="true" defaultChecked={includeArchived} />
            Include archived
          </label>
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Tenant records" className="mb-6">
        <Table head={['Name', 'Email', 'Phone', 'Leases', '']}>
          {tenants.length === 0 ? (
            <EmptyRow colSpan={5}>No tenants yet. Invite one below.</EmptyRow>
          ) : (
            tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/tenants/${tenant.id}`}>{tenant.name}</TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">{tenant.email}</td>
                <td className="px-2 py-2 text-slate-600">{tenant.phone ?? '—'}</td>
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

      <Card title="Invite a tenant" className="mb-6">
        <p className="mb-3 text-sm text-slate-600">
          The tenant signs in with this email and sees their own lease and rent. The record appears
          here once they accept the link (valid for 7 days).
        </p>
        <form action={inviteTenantAction} className="flex flex-wrap items-end gap-3">
          <Field label="Tenant email" className="min-w-64 flex-1">
            <input
              name="email"
              type="email"
              required
              placeholder="tenant@example.com"
              className={inputClass}
            />
          </Field>
          <SubmitButton className={buttonClass} pendingLabel="Creating…">
            Create invitation link
          </SubmitButton>
        </form>
      </Card>

      <Card title={`Pending invitations (${invitations.length})`}>
        {invitations.length === 0 ? (
          <p className="text-sm text-slate-600">No pending tenant invitations.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-600">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                {invitation.email} · expires {invitation.expiresAt.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
