import Link from 'next/link';
import { requireVendor } from '@/lib/auth/session';
import { listVendorWorkOrders } from '@/lib/domain/vendor-portal';
import { formatDate } from '@/lib/domain/dates';
import { Badge, Card, EmptyRow, PageHeader, Table, TextLink } from '@/components/ui';
import { PRIORITY_LABEL, WORK_ORDER_STATUS_LABEL, priorityTone } from '@/lib/labels';

export default async function VendorHomePage() {
  const context = await requireVendor();
  const workOrders = await listVendorWorkOrders(context.vendorIds);

  return (
    <>
      <PageHeader
        title="Assigned work orders"
        subtitle="Jobs assigned to you by property owners. Update the status as you work."
      />

      <Card title="Work orders">
        <Table head={['Job', 'Property / unit', 'Tenant', 'Scheduled', 'Status', '']}>
          {workOrders.length === 0 ? (
            <EmptyRow colSpan={6}>No work orders assigned yet.</EmptyRow>
          ) : (
            workOrders.map((workOrder) => (
              <tr key={workOrder.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/vendor/work-orders/${workOrder.id}`}>
                    {workOrder.request.description.length > 60
                      ? `${workOrder.request.description.slice(0, 60)}…`
                      : workOrder.request.description}
                  </TextLink>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {workOrder.request.category}
                    <Badge tone={priorityTone(workOrder.request.priority)}>
                      {PRIORITY_LABEL[workOrder.request.priority]}
                    </Badge>
                  </p>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {workOrder.request.unit.property.name} · {workOrder.request.unit.label}
                </td>
                <td className="px-2 py-2 text-slate-600">{workOrder.request.tenant.name}</td>
                <td className="px-2 py-2 text-slate-600">
                  {workOrder.scheduledFor ? formatDate(workOrder.scheduledFor) : '—'}
                </td>
                <td className="px-2 py-2">
                  <Badge tone={workOrder.status === 'CLOSED' ? 'gray' : 'blue'}>
                    {WORK_ORDER_STATUS_LABEL[workOrder.status] ?? workOrder.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/vendor/work-orders/${workOrder.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </>
  );
}
