import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTenant } from '@/lib/auth/session';
import { getTenantRequest } from '@/lib/domain/portal';
import {
  Alert,
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  Table,
  secondaryButtonClass,
} from '@/components/ui';
import { searchParam } from '@/lib/actions/helpers';
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  WORK_ORDER_STATUS_LABEL,
  priorityTone,
  requestStatusTone,
} from '@/lib/labels';

export default async function PortalRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const request = await getTenantRequest(context.db, context.tenant.id, id);
  if (!request) notFound();

  return (
    <>
      <PageHeader
        title={`${request.category} request`}
        subtitle={`${request.unit.property.name} · ${request.unit.label} · submitted ${request.createdAt.toISOString().slice(0, 10)}`}
        actions={
          <>
            <Badge tone={requestStatusTone(request.status)}>
              {REQUEST_STATUS_LABEL[request.status]}
            </Badge>
            <Badge tone={priorityTone(request.priority)}>{PRIORITY_LABEL[request.priority]}</Badge>
            <Link href="/portal/maintenance" className={secondaryButtonClass}>
              Back to requests
            </Link>
          </>
        }
      />

      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <Card title="Details" className="mb-6">
        <p className="whitespace-pre-line text-sm">{request.description}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>{REQUEST_STATUS_LABEL[request.status]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Priority</dt>
            <dd>{PRIORITY_LABEL[request.priority]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Scheduled</dt>
            <dd>{request.workOrder?.scheduledFor?.toISOString().slice(0, 10) ?? 'Not scheduled yet'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assigned to</dt>
            <dd>
              {request.workOrder?.assignee
                ? `${request.workOrder.assignee.user.name} (${request.workOrder.assignee.role
                    .replace('_', ' ')
                    .toLowerCase()})`
                : 'Not assigned yet'}
            </dd>
          </div>
          {request.workOrder ? (
            <div>
              <dt className="text-slate-500">Work order</dt>
              <dd>{WORK_ORDER_STATUS_LABEL[request.workOrder.status] ?? request.workOrder.status}</dd>
            </div>
          ) : null}
          {request.workOrder?.resolutionNote ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Resolution</dt>
              <dd>{request.workOrder.resolutionNote}</dd>
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

      <Card title="Status history">
        <Table head={['When', 'Status', 'Note']}>
          {request.events.length === 0 ? (
            <EmptyRow colSpan={3}>No history yet.</EmptyRow>
          ) : (
            request.events.map((event) => (
              <tr key={event.id}>
                <td className="px-2 py-2 text-slate-600">
                  {event.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-2 py-2">{REQUEST_STATUS_LABEL[event.toStatus]}</td>
                <td className="px-2 py-2 text-slate-600">{event.note ?? '—'}</td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </>
  );
}
