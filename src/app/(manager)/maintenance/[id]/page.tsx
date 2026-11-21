import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getRequest, listAssignableMembers } from '@/lib/domain/maintenance';
import {
  cancelRequestAction,
  createWorkOrderAction,
  reassignWorkOrderAction,
  triageRequestAction,
  updateWorkOrderStatusAction,
} from '../../maintenance-actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Badge,
  Card,
  Field,
  PageHeader,
  Table,
  TextLink,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  WORK_ORDER_STATUS_LABEL,
  dateToInput,
  priorityTone,
  requestStatusTone,
} from '@/lib/labels';

const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  SCHEDULED: [
    { value: 'IN_PROGRESS', label: 'Start work' },
    { value: 'RESOLVED', label: 'Resolve' },
    { value: 'CLOSED', label: 'Close' },
  ],
  IN_PROGRESS: [
    { value: 'RESOLVED', label: 'Resolve' },
    { value: 'CLOSED', label: 'Close' },
  ],
  RESOLVED: [{ value: 'CLOSED', label: 'Close' }],
};

export default async function MaintenanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const query = await searchParams;
  const request = await getRequest(context.db, id);
  if (!request) notFound();

  const isStaff = context.membership.role === 'STAFF';
  if (isStaff && request.workOrder?.assigneeMembershipId !== context.membership.id) {
    redirect(
      `/maintenance?error=${encodeURIComponent('Only the assigned staff member can open this work order.')}`,
    );
  }

  const members = isStaff ? [] : await listAssignableMembers(context.db);
  const canManage = !isStaff;
  const workOrder = request.workOrder;
  const terminal = request.status === 'CANCELLED' || request.status === 'CLOSED';
  const nextStatuses = workOrder ? (NEXT_STATUS[workOrder.status] ?? []) : [];

  return (
    <>
      <PageHeader
        title={`${request.category} · ${request.unit.property.name} ${request.unit.label}`}
        subtitle={`Reported by ${request.tenant.name} on ${request.createdAt.toISOString().slice(0, 10)}`}
        actions={
          <>
            <Badge tone={requestStatusTone(request.status)}>
              {REQUEST_STATUS_LABEL[request.status]}
            </Badge>
            <Badge tone={priorityTone(request.priority)}>{PRIORITY_LABEL[request.priority]}</Badge>
            <Link href="/maintenance" className={secondaryButtonClass}>
              Back to queue
            </Link>
          </>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <Card title="Request" className="mb-6">
        <p className="whitespace-pre-line text-sm">{request.description}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Tenant</dt>
            <dd>
              <TextLink href={`/tenants/${request.tenantId}`}>{request.tenant.name}</TextLink> ·{' '}
              {request.tenant.email}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Unit</dt>
            <dd>
              <TextLink href={`/properties/${request.unit.propertyId}`}>
                {request.unit.property.name}
              </TextLink>{' '}
              · {request.unit.label}
            </dd>
          </div>
          {request.triageNote ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Triage note</dt>
              <dd>{request.triageNote}</dd>
            </div>
          ) : null}
          {request.cancelledReason ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Cancellation reason</dt>
              <dd>{request.cancelledReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {canManage && !terminal ? (
          <Card title="Triage">
            <form action={triageRequestAction} className="grid gap-4">
              <input type="hidden" name="requestId" value={request.id} />
              <Field label="Priority">
                <select name="priority" defaultValue={request.priority} className={inputClass}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </Field>
              <Field label="Triage note">
                <textarea name="note" rows={2} defaultValue={request.triageNote ?? ''} className={inputClass} />
              </Field>
              <SubmitButton className={secondaryButtonClass}>Save triage</SubmitButton>
            </form>
          </Card>
        ) : null}

        {workOrder ? (
          <Card title="Work order">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Status</dt>
              <dd>
                {WORK_ORDER_STATUS_LABEL[workOrder.status] ?? workOrder.status}
              </dd>
              <dt className="text-slate-500">Assignee</dt>
              <dd>{workOrder.assignee?.user.name ?? 'Unassigned'}</dd>
              <dt className="text-slate-500">Scheduled</dt>
              <dd>{workOrder.scheduledFor?.toISOString().slice(0, 10) ?? '—'}</dd>
              {workOrder.resolutionNote ? (
                <>
                  <dt className="text-slate-500">Resolution</dt>
                  <dd>{workOrder.resolutionNote}</dd>
                </>
              ) : null}
            </dl>

            {nextStatuses.length > 0 ? (
              <form action={updateWorkOrderStatusAction} className="mt-4 grid gap-3">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="workOrderId" value={workOrder.id} />
                <Field label="Update status">
                  <select name="status" defaultValue={nextStatuses[0].value} className={inputClass}>
                    {nextStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Note" hint="Required when resolving.">
                  <textarea name="note" rows={2} className={inputClass} />
                </Field>
                <SubmitButton className={buttonClass} pendingLabel="Updating…">
                  Update work order
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-500">This work order is closed.</p>
            )}

            {canManage && workOrder.status !== 'CLOSED' ? (
              <form action={reassignWorkOrderAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="workOrderId" value={workOrder.id} />
                <Field label="Reassign to" className="min-w-48 flex-1">
                  <select name="assigneeMembershipId" defaultValue={workOrder.assigneeMembershipId ?? ''} className={inputClass}>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.user.name} · {member.role.replace('_', ' ').toLowerCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <SubmitButton className={secondaryButtonClass}>Reassign</SubmitButton>
              </form>
            ) : null}
          </Card>
        ) : canManage ? (
          <Card title="Create a work order">
            <form action={createWorkOrderAction} className="grid gap-4">
              <input type="hidden" name="requestId" value={request.id} />
              <Field label="Assign to">
                <select name="assigneeMembershipId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select a team member
                  </option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.name} · {member.role.replace('_', ' ').toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Scheduled date">
                <input
                  name="scheduledFor"
                  type="date"
                  required
                  defaultValue={dateToInput(new Date())}
                  className={inputClass}
                />
              </Field>
              <Field label="Note">
                <input name="note" className={inputClass} placeholder="Parts ordered, access instructions…" />
              </Field>
              <SubmitButton className={buttonClass} pendingLabel="Assigning…">
                Create and assign
              </SubmitButton>
            </form>
          </Card>
        ) : null}
      </div>

      {canManage && !terminal ? (
        <Card title="Cancel request" className="mb-6">
          <form action={cancelRequestAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="requestId" value={request.id} />
            <Field label="Reason" className="min-w-64 flex-1">
              <input name="reason" required className={inputClass} />
            </Field>
            <SubmitButton
              className="text-sm text-rose-700 underline"
              confirm="Cancel this request and close any open work order?"
            >
              Cancel request
            </SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card title="History">
        <Table head={['When', 'Status change', 'Note']}>
          {request.events.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-sm text-slate-500" colSpan={3}>
                No history recorded.
              </td>
            </tr>
          ) : (
            request.events.map((event) => (
              <tr key={event.id}>
                <td className="px-2 py-2 text-slate-600">{event.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="px-2 py-2">
                  {event.fromStatus ? `${REQUEST_STATUS_LABEL[event.fromStatus]} → ` : ''}
                  {REQUEST_STATUS_LABEL[event.toStatus]}
                </td>
                <td className="px-2 py-2 text-slate-600">{event.note ?? '—'}</td>
              </tr>
            ))
          )}
        </Table>
        {workOrder && workOrder.events.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Work order events</h3>
            <Table head={['When', 'Status change', 'Note']}>
              {workOrder.events.map((event) => (
                <tr key={event.id}>
                  <td className="px-2 py-2 text-slate-600">
                    {event.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-2 py-2">
                    {event.fromStatus ? `${event.fromStatus} → ` : ''}
                    {event.toStatus}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{event.note ?? '—'}</td>
                </tr>
              ))}
            </Table>
          </div>
        ) : null}
      </Card>
    </>
  );
}
