'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import {
  archiveProperty,
  archiveUnit,
  createProperty,
  createUnit,
  removeUnit,
  setUnitAvailable,
  setUnitOffMarket,
  updateProperty,
  updateUnit,
} from '@/lib/domain/properties';
import { fail, formMoneyCents, formNumber, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

const MANAGER_ROLES = ['OWNER', 'PROPERTY_MANAGER'] as const;

export async function createPropertyAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  try {
    await createProperty(db, organizationId, {
      name: formValue(form, 'name'),
      addressLine1: formValue(form, 'addressLine1'),
      city: formValue(form, 'city'),
      region: formValue(form, 'region'),
      postalCode: formValue(form, 'postalCode'),
      notes: formOptionalValue(form, 'notes'),
    });
  } catch (error) {
    fail('/properties', error);
  }
  revalidatePath('/properties');
  succeed('/properties', 'Property created.');
}

export async function updatePropertyAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  try {
    await updateProperty(db, propertyId, {
      name: formValue(form, 'name'),
      addressLine1: formValue(form, 'addressLine1'),
      city: formValue(form, 'city'),
      region: formValue(form, 'region'),
      postalCode: formValue(form, 'postalCode'),
      notes: formOptionalValue(form, 'notes'),
    });
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Property updated.');
}

export async function archivePropertyAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  try {
    await archiveProperty(db, propertyId);
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath('/properties');
  succeed('/properties', 'Property archived.');
}

export async function createUnitAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  try {
    await createUnit(db, organizationId, propertyId, {
      label: formValue(form, 'label'),
      bedrooms: formNumber(form, 'bedrooms'),
      bathrooms: formNumber(form, 'bathrooms'),
      rentAmountCents: formMoneyCents(form, 'rentAmount'),
    });
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Unit added.');
}

export async function updateUnitAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  const unitId = formValue(form, 'unitId');
  try {
    await updateUnit(db, unitId, {
      label: formValue(form, 'label'),
      bedrooms: formNumber(form, 'bedrooms'),
      bathrooms: formNumber(form, 'bathrooms'),
      rentAmountCents: formMoneyCents(form, 'rentAmount'),
    });
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Unit updated.');
}

export async function setUnitStatusAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  const unitId = formValue(form, 'unitId');
  const status = formValue(form, 'status');
  try {
    if (status === 'OFF_MARKET') {
      await setUnitOffMarket(db, unitId);
    } else {
      await setUnitAvailable(db, unitId);
    }
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Unit status updated.');
}

export async function archiveUnitAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  try {
    await archiveUnit(db, formValue(form, 'unitId'));
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Unit archived.');
}

export async function removeUnitAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const propertyId = formValue(form, 'propertyId');
  try {
    await removeUnit(db, formValue(form, 'unitId'));
  } catch (error) {
    fail(`/properties/${propertyId}`, error);
  }
  revalidatePath(`/properties/${propertyId}`);
  succeed(`/properties/${propertyId}`, 'Unit removed.');
}
