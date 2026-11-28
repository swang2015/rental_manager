import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getCharge } from '@/lib/domain/billing';
import { formatDate, formatMoney } from '@/lib/domain/dates';
import { recordAdjustmentAction, recordPaymentAction } from '../../billing-actions';
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
import { CHARGE_STATUS_LABEL, chargeStatusTone, dateToInput } from '@/lib/labels';

export default async function ChargeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ chargeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { chargeId } = await params;
  const query = await searchParams;
  const month = searchParam(query, 'month') ?? new Date().toISOString().slice(0, 7);
  const charge = await getCharge(context.db, context.timezone, chargeId);
  if (!charge) notFound();

  const canRecord = true;

  return (
    <>
      <PageHeader
        title={`Charge · ${charge.lease.tenant.name}`}
        subtitle={`${charge.lease.unit.property.name} ${charge.lease.unit.label} · due ${formatDate(charge.dueDate)}`}
        actions={
          <>
            <Badge tone={chargeStatusTone(charge.status)}>
              {CHARGE_STATUS_LABEL[charge.status]}
              {charge.status === 'overdue' ? ` · ${charge.daysLate} days late` : ''}
            </Badge>
            <Link href={`/rent?month=${month}`} className={secondaryButtonClass}>
              Back to ledger
            </Link>
          </>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Amount" value={formatMoney(charge.amountCents)} />
        <Stat label="Paid" value={formatMoney(charge.paidCents)} />
        <Stat label="Balance" value={formatMoney(charge.balanceCents)} />
        <Stat label="Period" value={charge.periodStart.toISOString().slice(0, 7)} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Payments">
          <Table head={['Date', 'Amount', 'Method', 'Reference']}>
            {charge.payments.length === 0 ? (
              <EmptyRow colSpan={4}>No payments recorded.</EmptyRow>
            ) : (
              charge.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-2 py-2">{formatDate(payment.paidOn)}</td>
                  <td className="px-2 py-2">{formatMoney(payment.amountCents)}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {payment.method.replace('_', ' ').toLowerCase()}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{payment.reference ?? '—'}</td>
                </tr>
              ))
            )}
          </Table>
        </Card>

        <Card title="Adjustments and waivers">
          <Table head={['Date', 'Amount', 'Reason']}>
            {charge.adjustments.length === 0 ? (
              <EmptyRow colSpan={3}>No adjustments recorded.</EmptyRow>
            ) : (
              charge.adjustments.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td className="px-2 py-2">{formatDate(adjustment.createdAt)}</td>
                  <td className="px-2 py-2">{formatMoney(adjustment.amountCents)}</td>
                  <td className="px-2 py-2 text-slate-600">{adjustment.reason}</td>
                </tr>
              ))
            )}
          </Table>
        </Card>
      </div>

      {canRecord && charge.balanceCents > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Record a payment">
            <form action={recordPaymentAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="chargeId" value={charge.id} />
              <input type="hidden" name="month" value={month} />
              <Field label="Amount" hint={`Balance ${formatMoney(charge.balanceCents)}`}>
                <input
                  name="amount"
                  required
                  defaultValue={(charge.balanceCents / 100).toFixed(2)}
                  className={inputClass}
                />
              </Field>
              <Field label="Payment date">
                <input
                  name="paidOn"
                  type="date"
                  required
                  defaultValue={dateToInput(new Date())}
                  className={inputClass}
                />
              </Field>
              <Field label="Method">
                <select name="method" className={inputClass} defaultValue="BANK_TRANSFER">
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Reference">
                <input name="reference" className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className={buttonClass} pendingLabel="Recording…">
                  Record payment
                </SubmitButton>
              </div>
            </form>
          </Card>

          <Card title="Record an adjustment or waiver">
            <form action={recordAdjustmentAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="chargeId" value={charge.id} />
              <input type="hidden" name="month" value={month} />
              <Field label="Amount" hint={`Cannot exceed ${formatMoney(charge.balanceCents)}`}>
                <input name="amount" required className={inputClass} />
              </Field>
              <Field label="Reason">
                <input name="reason" required placeholder="Repair credit" className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className={secondaryButtonClass} pendingLabel="Saving…">
                  Record adjustment
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      ) : canRecord ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          This charge is fully paid. No balance remains.
        </p>
      ) : null}

      <p className="mt-6 text-sm text-slate-500">
        Lease:{' '}
        <TextLink href={`/leases/${charge.lease.id}`}>
          {charge.lease.unit.property.name} · {charge.lease.unit.label}
        </TextLink>
      </p>
    </>
  );
}
