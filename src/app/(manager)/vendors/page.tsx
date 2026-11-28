import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listPendingVendorInvitations, listVendors } from '@/lib/domain/vendors';
import { inviteVendorAction } from '../vendor-actions';
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

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const search = searchParam(params, 'q') ?? '';
  const invite = searchParam(params, 'invite');

  const [vendors, invitations] = await Promise.all([
    listVendors(context.db, { search }),
    listPendingVendorInvitations(context.db),
  ]);

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Contractors who can sign in, see assigned work orders, and update progress."
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
              placeholder="Name, company, trade"
              className={inputClass}
            />
          </Field>
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Vendor directory" className="mb-6">
        <Table head={['Name', 'Company', 'Trade', 'Phone', 'Work orders', '']}>
          {vendors.length === 0 ? (
            <EmptyRow colSpan={6}>No vendors yet. Invite one below.</EmptyRow>
          ) : (
            vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/vendors/${vendor.id}`}>{vendor.name}</TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">{vendor.company ?? '—'}</td>
                <td className="px-2 py-2 text-slate-600">{vendor.trade ?? '—'}</td>
                <td className="px-2 py-2 text-slate-600">{vendor.phone ?? '—'}</td>
                <td className="px-2 py-2">{vendor._count.workOrders}</td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/vendors/${vendor.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <Card title="Invite a vendor" className="mb-6">
        <p className="mb-3 text-sm text-slate-600">
          The vendor signs in with this email, sees only work orders assigned to them, and can mark
          progress. The record appears here once they accept the link (valid for 7 days).
        </p>
        <form action={inviteVendorAction} className="flex flex-wrap items-end gap-3">
          <Field label="Vendor email" className="min-w-64 flex-1">
            <input
              name="email"
              type="email"
              required
              placeholder="vendor@example.com"
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
          <p className="text-sm text-slate-600">No pending vendor invitations.</p>
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
