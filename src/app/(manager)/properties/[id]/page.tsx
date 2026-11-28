import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth/session';
import { getProperty } from '@/lib/domain/properties';
import { formatMoney } from '@/lib/domain/dates';
import {
  archivePropertyAction,
  archiveUnitAction,
  createUnitAction,
  removeUnitAction,
  setUnitStatusAction,
  updatePropertyAction,
  updateUnitAction,
} from '../../property-actions';
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
import { UNIT_STATUS_LABEL, centsToInput, unitStatusTone } from '@/lib/labels';

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const query = await searchParams;
  const property = await getProperty(context.db, id);
  if (!property) notFound();

  const canManage = true;

  return (
    <>
      <PageHeader
        title={property.name}
        subtitle={`${property.addressLine1}, ${property.city}, ${property.region} ${property.postalCode}`}
        actions={
          <Link href="/properties" className={secondaryButtonClass}>
            Back to properties
          </Link>
        }
      />
      <Alert error={searchParam(query, 'error')} ok={searchParam(query, 'ok')} />

      {canManage ? (
        <Card title="Property details" className="mb-6">
          <form action={updatePropertyAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="Property name">
              <input name="name" defaultValue={property.name} required className={inputClass} />
            </Field>
            <Field label="Street address">
              <input
                name="addressLine1"
                defaultValue={property.addressLine1}
                required
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input name="city" defaultValue={property.city} required className={inputClass} />
            </Field>
            <Field label="Region / state">
              <input name="region" defaultValue={property.region} required className={inputClass} />
            </Field>
            <Field label="Postal code">
              <input
                name="postalCode"
                defaultValue={property.postalCode}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                name="notes"
                rows={2}
                defaultValue={property.notes ?? ''}
                className={inputClass}
              />
            </Field>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <SubmitButton className={buttonClass} pendingLabel="Saving…">
                Save property
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <Card
        title={`Units (${property.units.length})`}
        className="mb-6"
        actions={
          canManage ? (
            <form action={archivePropertyAction}>
              <input type="hidden" name="propertyId" value={property.id} />
              <SubmitButton
                className="text-sm text-rose-700 underline"
                confirm="Archive this property? It disappears from active lists."
              >
                Archive property
              </SubmitButton>
            </form>
          ) : null
        }
      >
        <Table head={['Unit', 'Beds / baths', 'Rent', 'Status', 'Current tenant', 'Actions']}>
          {property.units.length === 0 ? (
            <EmptyRow colSpan={6}>No units yet. Add the first one below.</EmptyRow>
          ) : (
            property.units.map((unit) => (
              <tr key={unit.id} className="align-top">
                <td className="px-2 py-2 font-medium">{unit.label}</td>
                <td className="px-2 py-2 text-slate-600">
                  {unit.bedrooms} bd · {unit.bathrooms} ba
                </td>
                <td className="px-2 py-2">{formatMoney(unit.rentAmountCents)}</td>
                <td className="px-2 py-2">
                  <Badge tone={unitStatusTone(unit.status)}>
                    {UNIT_STATUS_LABEL[unit.status] ?? unit.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {unit.leases.length > 0 ? (
                    <Link href={`/leases/${unit.leases[0].id}`}>{unit.leases[0].tenant.name}</Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2">
                  {canManage ? (
                    <div className="space-y-2">
                      <details>
                        <summary className="cursor-pointer text-sm">Edit</summary>
                        <form action={updateUnitAction} className="mt-2 grid gap-2">
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="unitId" value={unit.id} />
                          <input name="label" defaultValue={unit.label} className={inputClass} />
                          <div className="flex gap-2">
                            <input
                              name="bedrooms"
                              type="number"
                              min="0"
                              defaultValue={unit.bedrooms}
                              className={inputClass}
                            />
                            <input
                              name="bathrooms"
                              type="number"
                              min="0"
                              step="0.5"
                              defaultValue={unit.bathrooms}
                              className={inputClass}
                            />
                            <input
                              name="rentAmount"
                              defaultValue={centsToInput(unit.rentAmountCents)}
                              className={inputClass}
                            />
                          </div>
                          <SubmitButton className={secondaryButtonClass}>Save</SubmitButton>
                        </form>
                      </details>
                      <form action={setUnitStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="unitId" value={unit.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={unit.status === 'OFF_MARKET' ? 'AVAILABLE' : 'OFF_MARKET'}
                        />
                        <SubmitButton className="text-xs text-slate-600 underline">
                          {unit.status === 'OFF_MARKET' ? 'Mark available' : 'Mark off-market'}
                        </SubmitButton>
                      </form>
                      <div className="flex gap-2 text-xs">
                        <form action={archiveUnitAction}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="unitId" value={unit.id} />
                          <SubmitButton className="text-slate-600 underline">Archive</SubmitButton>
                        </form>
                        <form action={removeUnitAction}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="unitId" value={unit.id} />
                          <SubmitButton
                            className="text-rose-700 underline"
                            confirm="Remove this unit permanently? Units with lease history cannot be removed."
                          >
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {canManage ? (
        <Card title="Add a unit">
          <form action={createUnitAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="Label">
              <input name="label" required placeholder="2B" className={inputClass} />
            </Field>
            <Field label="Bedrooms">
              <input
                name="bedrooms"
                type="number"
                min="0"
                defaultValue={1}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Bathrooms">
              <input
                name="bathrooms"
                type="number"
                min="0"
                step="0.5"
                defaultValue={1}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Monthly rent">
              <input name="rentAmount" required placeholder="3200.00" className={inputClass} />
            </Field>
            <div className="flex items-end">
              <SubmitButton className={buttonClass} pendingLabel="Adding…">
                Add unit
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <p className="mt-6 text-sm text-slate-500">
        Looking for lease history? Open a <TextLink href="/leases">lease</TextLink> or a tenant
        record.
      </p>
    </>
  );
}
