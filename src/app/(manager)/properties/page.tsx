import Link from 'next/link';
import { requireManager } from '@/lib/auth/session';
import { listProperties, listUnits } from '@/lib/domain/properties';
import { formatMoney } from '@/lib/domain/dates';
import { createPropertyAction } from '../property-actions';
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
import { UNIT_STATUS_LABEL, unitStatusTone } from '@/lib/labels';

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const params = await searchParams;
  const search = searchParam(params, 'q') ?? '';
  const archived = searchParam(params, 'archived') === 'true';
  const status = searchParam(params, 'status') ?? '';

  const properties = await listProperties(context.db, { archived, search });
  const units = status ? await listUnits(context.db, { status }) : [];
  const canManage = context.membership.role !== 'STAFF';

  return (
    <>
      <PageHeader title="Properties" subtitle="Buildings in your portfolio and their units." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-56 flex-1">
            <input name="q" defaultValue={search} placeholder="Name, street, city, postal code" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="archived" value="true" defaultChecked={archived} />
            Archived only
          </label>
          <SubmitButton className={secondaryButtonClass}>Filter</SubmitButton>
        </form>
      </Card>

      <Card title={archived ? 'Archived properties' : 'Active properties'} className="mb-6">        <Table head={['Property', 'Address', 'Units', 'Occupied', '']}>
          {properties.length === 0 ? (
            <EmptyRow colSpan={5}>No properties match this view yet.</EmptyRow>
          ) : (
            properties.map((property) => (
              <tr key={property.id}>
                <td className="px-2 py-2">
                  <TextLink href={`/properties/${property.id}`}>{property.name}</TextLink>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {property.addressLine1}, {property.city} {property.postalCode}
                </td>
                <td className="px-2 py-2">{property._count.units}</td>
                <td className="px-2 py-2">{property.occupiedUnits}</td>
                <td className="px-2 py-2 text-right">
                  <Link href={`/properties/${property.id}`} className="text-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {status ? (
        <Card title={`${UNIT_STATUS_LABEL[status] ?? status} units`} className="mb-6">
          <Table head={['Property', 'Unit', 'Rent', 'Status', 'Tenant']}>
            {units.length === 0 ? (
              <EmptyRow colSpan={5}>No units with this status.</EmptyRow>
            ) : (
              units.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-2 py-2">
                    <TextLink href={`/properties/${unit.property.id}`}>{unit.property.name}</TextLink>
                  </td>
                  <td className="px-2 py-2 font-medium">{unit.label}</td>
                  <td className="px-2 py-2">{formatMoney(unit.rentAmountCents)}</td>
                  <td className="px-2 py-2">
                    <Badge tone={unitStatusTone(unit.status)}>
                      {UNIT_STATUS_LABEL[unit.status] ?? unit.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {unit.leases.length > 0 ? unit.leases[0].tenant.name : '—'}
                  </td>
                </tr>
              ))
            )}
          </Table>
          <p className="mt-3 text-sm">
            <Link href="/properties" className="font-medium text-slate-900 underline">
              Clear status filter
            </Link>
          </p>
        </Card>
      ) : null}

      {canManage ? (
        <Card title="Add a property">
          <form action={createPropertyAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Property name">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Street address">
              <input name="addressLine1" required className={inputClass} />
            </Field>
            <Field label="City">
              <input name="city" required className={inputClass} />
            </Field>
            <Field label="Region / state">
              <input name="region" required className={inputClass} />
            </Field>
            <Field label="Postal code">
              <input name="postalCode" required className={inputClass} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea name="notes" rows={2} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton className={buttonClass} pendingLabel="Creating…">
                Add property
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
    </>
  );
}
