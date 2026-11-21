import { requireTenant } from '@/lib/auth/session';
import { getTenantCharges } from '@/lib/domain/portal';
import { formatDate, formatMoney } from '@/lib/domain/dates';
import {
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  Stat,
  Table,
} from '@/components/ui';
import { CHARGE_STATUS_LABEL, chargeStatusTone } from '@/lib/labels';

export default async function PortalRentPage() {
  const context = await requireTenant();
  const charges = await getTenantCharges(context.db, context.tenant.id, context.organization.timezone);

  const outstanding = charges.reduce((sum, charge) => sum + charge.balanceCents, 0);
  const overdue = charges.filter((charge) => charge.status === 'overdue');
  const paid = charges.reduce((sum, charge) => sum + charge.paidCents, 0);

  return (
    <>
      <PageHeader title="Your rent" subtitle="Charges and payments recorded by your manager." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatMoney(outstanding)} />
        <Stat label="Paid to date" value={formatMoney(paid)} />
        <Stat label="Overdue charges" value={overdue.length} />
      </div>

      <Card title="Charges">
        <Table head={['Period', 'Due', 'Amount', 'Paid', 'Balance', 'Status']}>
          {charges.length === 0 ? (
            <EmptyRow colSpan={6}>No charges recorded yet.</EmptyRow>
          ) : (
            charges.map((charge) => (
              <tr key={charge.id}>
                <td className="px-2 py-2">{charge.periodStart.toISOString().slice(0, 7)}</td>
                <td className="px-2 py-2 text-slate-600">{formatDate(charge.dueDate)}</td>
                <td className="px-2 py-2">{formatMoney(charge.amountCents)}</td>
                <td className="px-2 py-2">{formatMoney(charge.paidCents)}</td>
                <td className="px-2 py-2">{formatMoney(charge.balanceCents)}</td>
                <td className="px-2 py-2">
                  <Badge tone={chargeStatusTone(charge.status)}>
                    {CHARGE_STATUS_LABEL[charge.status]}
                    {charge.status === 'overdue' ? ` · ${charge.daysLate}d` : ''}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <div className="mt-6">
        <Card title="Payment history">
          <Table head={['Paid on', 'Amount', 'Method', 'Reference']}>
            {charges.every((charge) => charge.payments.length === 0) ? (
              <EmptyRow colSpan={4}>No payments recorded yet.</EmptyRow>
            ) : (
              charges.flatMap((charge) =>
                charge.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-2 py-2">{formatDate(payment.paidOn)}</td>
                    <td className="px-2 py-2">{formatMoney(payment.amountCents)}</td>
                    <td className="px-2 py-2 text-slate-600">
                      {payment.method.replace('_', ' ').toLowerCase()}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{payment.reference ?? '—'}</td>
                  </tr>
                )),
              )
            )}
          </Table>
        </Card>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Payments are recorded by your property manager. Contact them if a payment is missing.
      </p>
    </>
  );
}
