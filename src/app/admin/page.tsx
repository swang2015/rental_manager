import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createOrganizationAction, enterOrganizationAction, inviteOwnerAction } from './actions';
import { searchParam } from '@/lib/actions/helpers';
import { Alert, Card, Field, PageHeader, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { ROLE_LABEL } from '@/lib/labels';

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSuperAdmin();
  const params = await searchParams;
  const invite = searchParam(params, 'invite');

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { memberships: true, properties: true } },
      invitations: {
        where: { kind: 'MANAGER', acceptedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle={`Signed in as ${user.name}. Create organizations and hand each one to an owner.`}
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />
      {invite ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Share this invitation link: <code>{invite}</code>
        </p>
      ) : null}

      <Card title="New organization" className="mb-6">
        <form action={createOrganizationAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name">
            <input name="name" required className={inputClass} />
          </Field>
          <Field label="Timezone" hint="Used to decide when rent is overdue.">
            <select name="timezone" defaultValue="Asia/Shanghai" className={inputClass}>
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Owner email (optional)"
            hint="Creates an owner invitation link you can share. Leave empty to create the organization only."
            className="sm:col-span-2"
          >
            <input
              name="ownerEmail"
              type="email"
              placeholder="owner@example.com"
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton className={buttonClass}>Create organization</SubmitButton>
          </div>
        </form>
      </Card>

      {organizations.length === 0 ? (
        <Card title="No organizations yet">
          <p className="text-sm text-slate-600">
            Create the first organization above, then invite its owner. You can open its workspace
            yourself at any time.
          </p>
        </Card>
      ) : (
        organizations.map((organization) => (
          <Card key={organization.id} title={organization.name} className="mb-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Slug: <code>{organization.slug}</code>
                </p>
                <p>Timezone: {organization.timezone}</p>
                <p>
                  {organization._count.memberships} member
                  {organization._count.memberships === 1 ? '' : 's'} ·{' '}
                  {organization._count.properties} propert
                  {organization._count.properties === 1 ? 'y' : 'ies'}
                </p>
                {organization.invitations.length > 0 ? (
                  <div>
                    <p className="font-medium text-slate-700">Pending invitations</p>
                    <ul className="mt-1 space-y-1">
                      {organization.invitations.map((invitation) => (
                        <li key={invitation.id}>
                          {invitation.email}
                          {invitation.role ? ` · ${ROLE_LABEL[invitation.role]}` : ''} · expires{' '}
                          {invitation.expiresAt.toISOString().slice(0, 10)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <form action={enterOrganizationAction}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <SubmitButton className={buttonClass}>Open workspace</SubmitButton>
                </form>

                <form action={inviteOwnerAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <Field label="Invite an owner" className="min-w-48 flex-1">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="owner@example.com"
                      className={inputClass}
                    />
                  </Field>
                  <SubmitButton className={buttonClass} pendingLabel="Creating…">
                    Create link
                  </SubmitButton>
                </form>
              </div>
            </div>
          </Card>
        ))
      )}
    </>
  );
}
