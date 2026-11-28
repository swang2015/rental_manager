import { requireManager } from '@/lib/auth/session';
import { listVendorTrades, listVendorsForOwner } from '@/lib/domain/vendors';
import { searchParam } from '@/lib/actions/helpers';
import {
  Alert,
  Card,
  EmptyRow,
  Field,
  PageHeader,
  Table,
  inputClass,
  secondaryButtonClass,
} from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const search = searchParam(params, 'q') ?? '';
  const trade = searchParam(params, 'trade') ?? '';

  const [vendors, trades] = await Promise.all([
    listVendorsForOwner(context.ownerUserId, { search, trade: trade || undefined }),
    listVendorTrades(),
  ]);

  return (
    <>
      <PageHeader
        title="Vendor directory"
        subtitle="Shared contractors maintained by the platform. Pick one when you create a work order."
      />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-56 flex-1">
            <input name="q" defaultValue={search} placeholder="Name, company, trade" className={inputClass} />
          </Field>
          <Field label="Trade" className="w-48">
            <select name="trade" defaultValue={trade} className={inputClass}>
              <option value="">All trades</option>
              {trades.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title="Vendors">
        <Table head={['Name', 'Company', 'Trade', 'Contact', 'Your work orders']}>
          {vendors.length === 0 ? (
            <EmptyRow colSpan={5}>No vendors match this view.</EmptyRow>
          ) : (
            vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td className="px-2 py-2 font-medium">{vendor.name}</td>
                <td className="px-2 py-2 text-slate-600">{vendor.company ?? '—'}</td>
                <td className="px-2 py-2 text-slate-600">{vendor.trade ?? '—'}</td>
                <td className="px-2 py-2 text-slate-600">
                  {vendor.phone ?? vendor.user.email}
                </td>
                <td className="px-2 py-2">{vendor._count.workOrders}</td>
              </tr>
            ))
          )}
        </Table>
        <p className="mt-4 text-sm text-slate-600">
          Vendors are platform-wide, so the same contractor can work for several owners. The
          platform administrator maintains this list; when you open a maintenance request the
          vendor whose trade matches the category is suggested first, and you can still choose
          anyone from the directory.
        </p>
      </Card>
    </>
  );
}
