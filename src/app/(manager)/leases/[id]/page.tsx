import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getLease } from '@/lib/domain/leases';
import { formatDate, formatMoney } from '@/lib/domain/dates';
import {
  activateLeaseAction,
  renewLeaseAction,
  terminateLeaseAction,
  updateLeaseAction,
} from '../../lease-actions';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Badge,
  Card,
  EmptyRow,
  Field,
  PageHeader,
  Stat,
  Table,
  TextLink,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { LEASE_STATUS_LABEL, centsToInput, dateToInput, leaseStatusTone } from '@/lib/labels';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const query = await searchParams;
  const lease = await getLease(context.db, id);
  if (!lease) notFound();

  const canManage = true;
  const renewalStart = addDays(lease.endDate, 1);
  const renewalEnd = new Date(
    Date.UTC(
      renewalStart.getUTCFullYear() + 1,
      renewalStart.getUTCMonth(),
      renewalStart.getUTCDate(),
    ),
  );

  return (
    <>
      <PageHeader
        title={`Lease · ${lease.unit.property.name} ${lease.unit.label}`}
        subtitle={`${lease.tenant.name} · ${formatDate(lease.startDate)} → ${formatDate(lease.endDate)}`}
        actions={
          <>
            <Badge tone={leaseStatusTone(lease.status)}>
              {LEASE_STATUS_LABEL[lease.status] ?? lease.status}
            </Badge>
            <Link href="/leases" className={secondaryButtonClass}>
              Back to leases
            </Link>
          </>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly rent" value={formatMoney(lease.rentAmountCents)} />
        <Stat label="Security deposit" value={formatMoney(lease.depositAmountCents)} />
        <Stat label="Rent due day" value={lease.dueDay} />
        <Stat label="Charges" value={lease.charges.length} hint="Generated billing periods" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Parties">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Tenant</dt>
            <dd>
              <TextLink href={`/tenants/${lease.tenantId}`}>{lease.tenant.name}</TextLink>
            </dd>
            <dt className="text-slate-500">Email</dt>
            <dd>{lease.tenant.email}</dd>
            <dt className="text-slate-500">Property</dt>
            <dd>
              <TextLink href={`/properties/${lease.unit.propertyId}`}>
                {lease.unit.property.name}
              </TextLink>
            </dd>
            <dt className="text-slate-500">Unit</dt>
            <dd>
              {lease.unit.label} · {lease.unit.bedrooms} bd / {lease.unit.bathrooms} ba
            </dd>
            {lease.terminationReason ? (
              <>
                <dt className="text-slate-500">Termination reason</dt>
                <dd>{lease.terminationReason}</dd>
              </>
            ) : null}
          </dl>
        </Card>
        <Card title="Renewal chain">
          <ul className="space-y-2 text-sm">
            <li>
              Predecessor:{' '}
              {lease.predecessor ? (
                <TextLink href={`/leases/${lease.predecessor.id}`}>Previous lease</TextLink>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </li>
            <li>
              Successor:{' '}
              {lease.successor ? (
                <TextLink href={`/leases/${lease.successor.id}`}>Renewal draft</TextLink>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </li>
          </ul>
        </Card>
      </div>

      {canManage && lease.status === 'DRAFT' ? (
        <Card
          title="Draft lease"
          className="mb-6"
          actions={
            <form action={activateLeaseAction}>
              <input type="hidden" name="leaseId" value={lease.id} />
              <SubmitButton className={buttonClass} pendingLabel="Activating…">
                Activate lease
              </SubmitButton>
            </form>
          }
        >
          <form action={updateLeaseAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="leaseId" value={lease.id} />
            <Field label="Start date">
              <input
                name="startDate"
                type="date"
                defaultValue={dateToInput(lease.startDate)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="End date">
              <input
                name="endDate"
                type="date"
                defaultValue={dateToInput(lease.endDate)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Rent due day" hint="1–28">
              <input
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue={lease.dueDay}
                className={inputClass}
              />
            </Field>
            <Field label="Monthly rent">
              <input
                name="rentAmount"
                defaultValue={centsToInput(lease.rentAmountCents)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Security deposit">
              <input
                name="depositAmount"
                defaultValue={centsToInput(lease.depositAmountCents)}
                required
                className={inputClass}
              />
            </Field>
            <div className="flex items-end">
              <SubmitButton className={secondaryButtonClass}>Save draft</SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      {canManage && lease.status === 'ACTIVE' ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card title="Extend or adjust">
            <form action={updateLeaseAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="leaseId" value={lease.id} />
              <Field label="End date" hint="Only a later date extends the lease.">
                <input
                  name="endDate"
                  type="date"
                  defaultValue={dateToInput(lease.endDate)}
                  className={inputClass}
                />
              </Field>
              <Field label="Monthly rent" hint="Applies to future charges only.">
                <input
                  name="rentAmount"
                  defaultValue={centsToInput(lease.rentAmountCents)}
                  className={inputClass}
                />
              </Field>
              <Field label="Rent due day" hint="1–28">
                <input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={lease.dueDay}
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end">
                <SubmitButton className={secondaryButtonClass}>Save changes</SubmitButton>
              </div>
            </form>
          </Card>

          <Card title="Renew">
            <form action={renewLeaseAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="leaseId" value={lease.id} />
              <input type="hidden" name="unitId" value={lease.unitId} />
              <input type="hidden" name="tenantId" value={lease.tenantId} />
              <Field label="New start date">
                <input
                  name="startDate"
                  type="date"
                  defaultValue={dateToInput(renewalStart)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="New end date">
                <input
                  name="endDate"
                  type="date"
                  defaultValue={dateToInput(renewalEnd)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Monthly rent">
                <input
                  name="rentAmount"
                  defaultValue={centsToInput(lease.rentAmountCents)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Security deposit">
                <input
                  name="depositAmount"
                  defaultValue={centsToInput(lease.depositAmountCents)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Rent due day">
                <input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={lease.dueDay}
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end">
                <SubmitButton className={secondaryButtonClass} pendingLabel="Creating…">
                  Create renewal draft
                </SubmitButton>
              </div>
            </form>
          </Card>

          <Card title="Terminate">
            <form action={terminateLeaseAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="leaseId" value={lease.id} />
              <Field label="End date">
                <input
                  name="endDate"
                  type="date"
                  defaultValue={dateToInput(new Date())}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Reason">
                <input name="reason" required placeholder="Tenant notice" className={inputClass} />
              </Field>
              <div className="flex items-end sm:col-span-2">
                <SubmitButton
                  className="text-sm text-rose-700 underline"
                  confirm="Terminate this lease and release the unit?"
                >
                  Terminate lease
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <Card title="Rent charges">
        <Table head={['Period', 'Due', 'Amount', 'Balance', '']}>
          {lease.charges.length === 0 ? (
            <EmptyRow colSpan={5}>No charges generated for this lease yet.</EmptyRow>
          ) : (
            lease.charges.map((charge) => (
              <tr key={charge.id}>
                <td className="px-2 py-2">{charge.periodStart.toISOString().slice(0, 7)}</td>
                <td className="px-2 py-2 text-slate-600">{formatDate(charge.dueDate)}</td>
                <td className="px-2 py-2">{formatMoney(charge.amountCents)}</td>
                <td className="px-2 py-2">{formatMoney(charge.balanceCents)}</td>
                <td className="px-2 py-2 text-right">
                  <Link
                    href={`/rent/${charge.id}?month=${charge.periodStart.toISOString().slice(0, 7)}`}
                    className="text-sm"
                  >
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
