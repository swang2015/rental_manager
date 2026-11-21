import { requireManager } from '@/lib/auth/session';
import { listMembers } from '@/lib/domain/members';
import { changeMemberRoleAction, inviteManagerAction, setMemberStatusAction } from '../member-actions';
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
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { ROLE_LABEL } from '@/lib/labels';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager(['OWNER']);
  const params = await searchParams;
  const members = await listMembers(context.db);
  const invitePath = searchParam(params, 'invite');

  return (
    <>
      <PageHeader title="Members" subtitle="Who can manage this organization and with which role." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />
      {invitePath ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Share this invitation link: <code>{invitePath}</code>
        </p>
      ) : null}

      <Card title="Team" className="mb-6">
        <Table head={['Member', 'Email', 'Role', 'Status', '']}>
          {members.length === 0 ? (
            <EmptyRow colSpan={5}>No members yet.</EmptyRow>
          ) : (
            members.map((member) => (
              <tr key={member.id}>
                <td className="px-2 py-2 font-medium">
                  {member.user.name}
                  {member.userId === context.user.id ? (
                    <span className="ml-2 text-xs text-slate-500">(you)</span>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-slate-600">{member.user.email}</td>
                <td className="px-2 py-2">
                  <form action={changeMemberRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="membershipId" value={member.id} />
                    <select name="role" defaultValue={member.role} className="rounded border border-slate-300 px-2 py-1 text-sm">
                      {(['OWNER', 'PROPERTY_MANAGER', 'STAFF'] as const).map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="text-xs text-slate-600 underline">Save</SubmitButton>
                  </form>
                </td>
                <td className="px-2 py-2">
                  {member.status === 'ACTIVE' ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Disabled</Badge>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  {member.userId === context.user.id ? null : (
                    <form action={setMemberStatusAction}>
                      <input type="hidden" name="membershipId" value={member.id} />
                      <input type="hidden" name="active" value={member.status === 'ACTIVE' ? 'false' : 'true'} />
                      <SubmitButton className="text-xs text-slate-600 underline">
                        {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <Card title="Invite a manager">
        <form action={inviteManagerAction} className="grid gap-4 sm:grid-cols-3">
          <Field label="Email">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="PROPERTY_MANAGER" className={inputClass}>
              <option value="PROPERTY_MANAGER">Property manager</option>
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner</option>
            </select>
          </Field>
          <div className="flex items-end">
            <SubmitButton className={buttonClass} pendingLabel="Creating…">
              Create invitation
            </SubmitButton>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          No email is sent in this release. Copy the link shown after creating the invitation and
          send it to the invitee. Invitations expire after 7 days and only work for the invited email.
        </p>
      </Card>
    </>
  );
}
