import Link from 'next/link';
import { requireTenant } from '@/lib/auth/session';
import { getTenantLeases, listTenantRequests } from '@/lib/domain/portal';
import { submitRequestAction } from '../actions';
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
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  priorityTone,
  requestStatusTone,
} from '@/lib/labels';

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Heating',
  'Appliance',
  'Structural',
  'Pest',
  'Other',
];

export default async function PortalMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenant();
  const params = await searchParams;
  const [leases, requests] = await Promise.all([
    getTenantLeases(context.db, context.tenant.id),
    listTenantRequests(context.db, context.tenant.id),
  ]);
  const activeLease = leases.find((lease) => lease.status === 'ACTIVE') ?? null;

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Report a problem and follow its progress." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card title="Report a problem" className="mb-6">
        {activeLease ? (
          <form action={submitRequestAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select name="category" required defaultValue="Plumbing" className={inputClass}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <input
                value={`${activeLease.unit.property.name} · ${activeLease.unit.label}`}
                readOnly
                className={inputClass}
              />
            </Field>
            <Field label="What is wrong?" className="sm:col-span-2">
              <textarea name="description" rows={3} required className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton className={buttonClass} pendingLabel="Submitting…">
                Submit request
              </SubmitButton>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            An active lease is required to submit a maintenance request.
          </p>
        )}
      </Card>

      <Card title="Your requests">
        <Table head={['Reported', 'Category', 'Priority', 'Status', '']}>
          {requests.length === 0 ? (
            <EmptyRow colSpan={5}>You have not submitted any requests.</EmptyRow>
          ) : (
            requests.map((request) => (
              <tr key={request.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/portal/maintenance/${request.id}`}>
                    {request.description.length > 60
                      ? `${request.description.slice(0, 60)}…`
                      : request.description}
                  </TextLink>
                  <p className="text-xs text-slate-500">
                    {request.unit.property.name} · {request.unit.label}
                  </p>
                </td>
                <td className="px-2 py-2 text-slate-600">{request.category}</td>
                <td className="px-2 py-2">
                  <Badge tone={priorityTone(request.priority)}>
                    {PRIORITY_LABEL[request.priority]}
                  </Badge>
                </td>
                <td className="px-2 py-2">
                  <Badge tone={requestStatusTone(request.status)}>
                    {REQUEST_STATUS_LABEL[request.status]}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/portal/maintenance/${request.id}`} className="text-sm">
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
