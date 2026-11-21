import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listAssignableMembers, listCategories, listRequests } from '@/lib/domain/maintenance';
import { listProperties, listUnits } from '@/lib/domain/properties';
import { listTenants } from '@/lib/domain/tenants';
import { createRequestOnBehalfAction } from '../maintenance-actions';
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
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  priorityTone,
  requestStatusTone,
} from '@/lib/labels';

const CATEGORIES = ['Plumbing', 'Electrical', 'Heating', 'Appliance', 'Structural', 'Pest', 'Other'];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const propertyId = searchParam(params, 'propertyId') ?? '';
  const status = searchParam(params, 'status') ?? '';
  const priority = searchParam(params, 'priority') ?? '';
  const category = searchParam(params, 'category') ?? '';
  const assignee = searchParam(params, 'assignee') ?? '';
  const search = searchParam(params, 'q') ?? '';
  const isStaff = context.membership.role === 'STAFF';

  const [requests, properties, members, categories, units, tenants] = await Promise.all([
    listRequests(context.db, {
      propertyId: propertyId || undefined,
      status: status || undefined,
      priority: priority || undefined,
      category: category || undefined,
      assigneeMembershipId: isStaff ? context.membership.id : assignee || undefined,
      search,
    }),
    listProperties(context.db),
    listAssignableMembers(context.db),
    listCategories(context.db),
    listUnits(context.db),
    listTenants(context.db),
  ]);
  const canManage = !isStaff;
  const categoryOptions = Array.from(new Set([...CATEGORIES, ...categories]));

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle={isStaff ? 'Work assigned to you.' : 'Repair requests and work orders.'}
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-44 flex-1">
            <input name="q" defaultValue={search} placeholder="Tenant or description" className={inputClass} />
          </Field>
          <Field label="Status" className="w-40">
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Any</option>
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'].map((value) => (
                <option key={value} value={value}>
                  {REQUEST_STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" className="w-36">
            <select name="priority" defaultValue={priority} className={inputClass}>
              <option value="">Any</option>
              {['LOW', 'MEDIUM', 'URGENT'].map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Property" className="w-48">
            <select name="propertyId" defaultValue={propertyId} className={inputClass}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" className="w-40">
            <select name="category" defaultValue={category} className={inputClass}>
              <option value="">Any</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          {!isStaff ? (
            <Field label="Assignee" className="w-48">
              <select name="assignee" defaultValue={assignee} className={inputClass}>
                <option value="">Anyone</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Request queue" className="mb-6">
        <Table head={['Request', 'Unit', 'Category', 'Priority', 'Status', 'Assignee', 'Opened', '']}>
          {requests.length === 0 ? (
            <EmptyRow colSpan={8}>No requests match this view.</EmptyRow>
          ) : (
            requests.map((request) => (
              <tr key={request.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/maintenance/${request.id}`}>
                    {request.description.length > 60
                      ? `${request.description.slice(0, 60)}…`
                      : request.description}
                  </TextLink>
                  <p className="text-xs text-slate-500">{request.tenant.name}</p>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {request.unit.property.name} · {request.unit.label}
                </td>
                <td className="px-2 py-2 text-slate-600">{request.category}</td>
                <td className="px-2 py-2">
                  <Badge tone={priorityTone(request.priority)}>{PRIORITY_LABEL[request.priority]}</Badge>
                </td>
                <td className="px-2 py-2">
                  <Badge tone={requestStatusTone(request.status)}>
                    {REQUEST_STATUS_LABEL[request.status]}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {request.workOrder?.assignee?.user.name ?? 'Unassigned'}
                </td>
                <td className="px-2 py-2 text-slate-600">{request.createdAt.toISOString().slice(0, 10)}</td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/maintenance/${request.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {canManage ? (
        <Card title="Log a request on a tenant's behalf">
          {tenants.length === 0 || units.length === 0 ? (
            <p className="text-sm text-slate-600">
              Add tenants and units before logging requests.
            </p>
          ) : (
            <form action={createRequestOnBehalfAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Tenant">
                <select name="tenantId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select a tenant
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unit">
                <select name="unitId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select a unit
                  </option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property.name} · {unit.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select name="category" required defaultValue="Plumbing" className={inputClass}>
                  {categoryOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select name="priority" defaultValue="MEDIUM" className={inputClass}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea name="description" rows={2} required className={inputClass} />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton className={buttonClass} pendingLabel="Creating…">
                  Log request
                </SubmitButton>
              </div>
            </form>
          )}
        </Card>
      ) : null}
    </>
  );
}
