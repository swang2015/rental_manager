import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import {
  approveUserAction,
  enterOwnerAction,
  inviteOwnerAction,
  rejectUserAction,
} from './actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Badge,
  Card,
  EmptyRow,
  Field,
  PageHeader,
  Table,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { ROLE_LABEL } from '@/lib/labels';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const invite = searchParam(params, 'invite');

  const [applicants, owners, ownerInvitations] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: 'OWNER' } }, status: 'ACTIVE' },
      include: {
        _count: { select: { properties: true, tenantDirectory: true, vendorDirectory: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { role: 'OWNER', acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Platform administration"
        subtitle="Approve accounts, invite property owners, and open any owner's workspace."
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />
      {invite ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Share this invitation link: <code>{invite}</code>
        </p>
      ) : null}

      <Card title={`Account requests (${applicants.length})`} className="mb-6">
        <Table head={['Name', 'Email', 'Requested role', 'Applied', '']}>
          {applicants.length === 0 ? (
            <EmptyRow colSpan={5}>No pending account requests.</EmptyRow>
          ) : (
            applicants.map((applicant) => (
              <tr key={applicant.id}>
                <td className="px-2 py-2 font-medium">{applicant.name}</td>
                <td className="px-2 py-2 text-slate-600">{applicant.email}</td>
                <td className="px-2 py-2">
                  {applicant.requestedRole ? (
                    <Badge tone="blue">{ROLE_LABEL[applicant.requestedRole]}</Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {applicant.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-end justify-end gap-2">
                    <form action={approveUserAction} className="flex items-end gap-2">
                      <input type="hidden" name="userId" value={applicant.id} />
                      <select
                        name="role"
                        defaultValue={applicant.requestedRole ?? 'OWNER'}
                        className={inputClass}
                      >
                        <option value="OWNER">Owner</option>
                        <option value="TENANT">Tenant</option>
                        <option value="VENDOR">Vendor</option>
                      </select>
                      <SubmitButton className={buttonClass}>Approve</SubmitButton>
                    </form>
                    <form action={rejectUserAction}>
                      <input type="hidden" name="userId" value={applicant.id} />
                      <SubmitButton
                        className="text-sm text-rose-700 underline"
                        confirm="Reject and delete this account request?"
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <Card title="Invite a property owner" className="mb-6">
        <form action={inviteOwnerAction} className="flex flex-wrap items-end gap-3">
          <Field label="Owner email" className="min-w-64 flex-1">
            <input
              name="email"
              type="email"
              required
              placeholder="owner@example.com"
              className={inputClass}
            />
          </Field>
          <SubmitButton className={buttonClass} pendingLabel="Creating…">
            Create invitation link
          </SubmitButton>
        </form>
        {ownerInvitations.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Pending owner invitations</p>
            <ul className="space-y-1 text-sm text-slate-600">
              {ownerInvitations.map((invitation) => (
                <li key={invitation.id}>
                  {invitation.email} · expires {invitation.expiresAt.toISOString().slice(0, 10)} ·
                  invited by {invitation.invitedBy.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card title={`Owners (${owners.length})`}>
        {owners.length === 0 ? (
          <p className="text-sm text-slate-600">
            No owners yet. Invite one above, or approve an owner application.
          </p>
        ) : (
          <div className="space-y-4">
            {owners.map((owner) => (
              <div
                key={owner.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{owner.name}</p>
                  <p className="text-sm text-slate-600">
                    {owner.email} · {owner.timezone}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {owner._count.properties} propert
                    {owner._count.properties === 1 ? 'y' : 'ies'} · {owner._count.tenantDirectory}{' '}
                    tenant
                    {owner._count.tenantDirectory === 1 ? '' : 's'} · {owner._count.vendorDirectory}{' '}
                    vendor
                    {owner._count.vendorDirectory === 1 ? '' : 's'}
                  </p>
                </div>
                <form action={enterOwnerAction}>
                  <input type="hidden" name="ownerUserId" value={owner.id} />
                  <SubmitButton className={secondaryButtonClass}>Open workspace</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
