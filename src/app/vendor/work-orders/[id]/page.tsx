import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireVendor } from '@/lib/auth/session';
import { getVendorWorkOrder } from '@/lib/domain/vendor-portal';
import { formatDate } from '@/lib/domain/dates';
import { updateAssignedWorkOrderAction } from '../../actions';
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
import { PRIORITY_LABEL, WORK_ORDER_STATUS_LABEL, priorityTone } from '@/lib/labels';

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

export default async function VendorWorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireVendor();
  const { id } = await params;
  const query = await searchParams;
  const workOrder = await getVendorWorkOrder(context.vendorIds, id);
  if (!workOrder) notFound();

  const request = workOrder.request;
  const property = request.unit.property;
  const nextStatuses = NEXT_STATUS[workOrder.status] ?? [];

  return (
    <>
      <PageHeader
        title={`${request.category} · ${property.name} ${request.unit.label}`}
        subtitle={`Scheduled ${workOrder.scheduledFor ? formatDate(workOrder.scheduledFor) : 'not yet'}`}
        actions={
          <>
            <Badge tone={priorityTone(request.priority)}>{PRIORITY_LABEL[request.priority]}</Badge>
            <Badge tone={workOrder.status === 'CLOSED' ? 'gray' : 'blue'}>
              {WORK_ORDER_STATUS_LABEL[workOrder.status] ?? workOrder.status}
            </Badge>
            <Link href="/vendor" className={secondaryButtonClass}>
              Back to work orders
            </Link>
          </>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Job details">
          <p className="whitespace-pre-line text-sm">{request.description}</p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd>
                {property.addressLine1}, {property.city} {property.region} {property.postalCode}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tenant contact</dt>
              <dd>
                {request.tenant.name} · {request.tenant.phone ?? request.tenant.email}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Owner</dt>
              <dd>
                {property.owner.name} · {property.owner.email}
              </dd>
            </div>
            {request.triageNote ? (
              <div>
                <dt className="text-slate-500">Owner note</dt>
                <dd>{request.triageNote}</dd>
              </div>
            ) : null}
            {workOrder.resolutionNote ? (
              <div>
                <dt className="text-slate-500">Resolution</dt>
                <dd>{workOrder.resolutionNote}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card title="Update progress">
          {nextStatuses.length === 0 ? (
            <p className="text-sm text-slate-600">This work order is closed. Thanks!</p>
          ) : (
            <form action={updateAssignedWorkOrderAction} className="grid gap-3">
              <input type="hidden" name="workOrderId" value={workOrder.id} />
              <Field label="New status">
                <select name="status" defaultValue={nextStatuses[0].value} className={inputClass}>
                  {nextStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note" hint="Required when resolving.">
                <textarea name="note" rows={3} className={inputClass} />
              </Field>
              <SubmitButton className={buttonClass} pendingLabel="Updating…">
                Update work order
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>

      <Card title="History">
        <Table head={['When', 'Status', 'Note']}>
          {workOrder.events.length === 0 ? (
            <EmptyRow colSpan={3}>No updates yet.</EmptyRow>
          ) : (
            workOrder.events.map((event) => (
              <tr key={event.id}>
                <td className="px-2 py-2 text-slate-600">
                  {event.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-2 py-2">
                  {event.fromStatus ? `${WORK_ORDER_STATUS_LABEL[event.fromStatus]} → ` : ''}
                  {WORK_ORDER_STATUS_LABEL[event.toStatus]}
                </td>
                <td className="px-2 py-2 text-slate-600">{event.note ?? '—'}</td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </>
  );
}
