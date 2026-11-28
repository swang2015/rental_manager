import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getVendor } from '@/lib/domain/vendors';
import { formatDate } from '@/lib/domain/dates';
import { archiveVendorAction, updateVendorAction } from '../../vendor-actions';
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
import { REQUEST_STATUS_LABEL, WORK_ORDER_STATUS_LABEL, requestStatusTone } from '@/lib/labels';

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const query = await searchParams;
  const vendor = await getVendor(context.db, id);
  if (!vendor) notFound();

  return (
    <>
      <PageHeader
        title={vendor.name}
        subtitle={[vendor.company, vendor.trade].filter(Boolean).join(' · ') || 'Vendor'}
        actions={
          <Link href="/vendors" className={secondaryButtonClass}>
            Back to vendors
          </Link>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Account" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Sign-in email</dt>
              <dd>{vendor.user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Joined</dt>
              <dd>{formatDate(vendor.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge tone={vendor.status === 'ACTIVE' ? 'green' : 'gray'}>
                  {vendor.status === 'ACTIVE' ? 'Active' : 'Archived'}
                </Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            The vendor can sign in at /vendor and update the work orders assigned to them.
          </p>
        </Card>

        <Card title="Work order history" className="lg:col-span-2">
          <Table head={['Request', 'Property / unit', 'Scheduled', 'Work order', '']}>
            {vendor.workOrders.length === 0 ? (
              <EmptyRow colSpan={5}>No work orders assigned yet.</EmptyRow>
            ) : (
              vendor.workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td className="px-2 py-2">
                    <TextLink href={`/maintenance/${workOrder.requestId}`}>
                      {workOrder.request.category}
                    </TextLink>
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {workOrder.request.unit.property.name} · {workOrder.request.unit.label}
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {workOrder.scheduledFor ? formatDate(workOrder.scheduledFor) : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Badge tone={requestStatusTone(workOrder.request.status)}>
                      {WORK_ORDER_STATUS_LABEL[workOrder.status] ?? workOrder.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-right text-slate-600">
                    {REQUEST_STATUS_LABEL[workOrder.request.status]}
                  </td>
                </tr>
              ))
            )}
          </Table>
        </Card>
      </div>

      <Card title="Vendor details">
        <form action={updateVendorAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="vendorId" value={vendor.id} />
          <Field label="Name">
            <input name="name" defaultValue={vendor.name} required className={inputClass} />
          </Field>
          <Field label="Company">
            <input name="company" defaultValue={vendor.company ?? ''} className={inputClass} />
          </Field>
          <Field label="Trade / specialty">
            <input
              name="trade"
              defaultValue={vendor.trade ?? ''}
              placeholder="Plumbing"
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={vendor.phone ?? ''} className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <SubmitButton className={buttonClass} pendingLabel="Saving…">
              Save vendor
            </SubmitButton>
          </div>
        </form>
        {vendor.status === 'ACTIVE' ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <form action={archiveVendorAction}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <SubmitButton
                className="text-sm text-slate-600 underline"
                confirm="Archive this vendor? Close any open work orders first."
              >
                Archive vendor
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </Card>
    </>
  );
}
