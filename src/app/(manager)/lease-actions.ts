'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import {
  activateLease,
  createDraftLease,
  renewLease,
  terminateLease,
  updateLease,
} from '@/lib/domain/leases';
import {
  fail,
  formDate,
  formMoneyCents,
  formNumber,
  formValue,
  succeed,
} from '@/lib/actions/helpers';

const MANAGER_ROLES = ['OWNER', 'PROPERTY_MANAGER'] as const;

export async function createLeaseAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  let leaseId: string;
  try {
    const lease = await createDraftLease(db, organizationId, {
      unitId: formValue(form, 'unitId'),
      tenantId: formValue(form, 'tenantId'),
      startDate: formDate(form, 'startDate'),
      endDate: formDate(form, 'endDate'),
      rentAmountCents: formMoneyCents(form, 'rentAmount'),
      depositAmountCents: formMoneyCents(form, 'depositAmount'),
      dueDay: formNumber(form, 'dueDay'),
    });
    leaseId = lease.id;
  } catch (error) {
    fail('/leases', error);
  }
  revalidatePath('/leases');
  succeed(`/leases/${leaseId}`, 'Draft lease created.');
}

export async function updateLeaseAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const leaseId = formValue(form, 'leaseId');
  try {
    const rentAmount = formValue(form, 'rentAmount');
    const depositAmount = formValue(form, 'depositAmount');
    const startDate = formValue(form, 'startDate');
    const endDate = formValue(form, 'endDate');
    const dueDay = formValue(form, 'dueDay');

    await updateLease(db, leaseId, {
      ...(startDate ? { startDate: formDate(form, 'startDate') } : {}),
      ...(endDate ? { endDate: formDate(form, 'endDate') } : {}),
      ...(rentAmount ? { rentAmountCents: formMoneyCents(form, 'rentAmount') } : {}),
      ...(depositAmount ? { depositAmountCents: formMoneyCents(form, 'depositAmount') } : {}),
      ...(dueDay ? { dueDay: formNumber(form, 'dueDay') } : {}),
    });
  } catch (error) {
    fail(`/leases/${leaseId}`, error);
  }
  revalidatePath(`/leases/${leaseId}`);
  succeed(`/leases/${leaseId}`, 'Lease updated.');
}

export async function activateLeaseAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  const leaseId = formValue(form, 'leaseId');
  try {
    await activateLease(db, organizationId, leaseId);
  } catch (error) {
    fail(`/leases/${leaseId}`, error);
  }
  revalidatePath(`/leases/${leaseId}`);
  revalidatePath('/properties');
  succeed(`/leases/${leaseId}`, 'Lease activated and unit occupied.');
}

export async function renewLeaseAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  const leaseId = formValue(form, 'leaseId');
  let successorId: string;
  try {
    const successor = await renewLease(db, organizationId, leaseId, {
      unitId: formValue(form, 'unitId'),
      tenantId: formValue(form, 'tenantId'),
      startDate: formDate(form, 'startDate'),
      endDate: formDate(form, 'endDate'),
      rentAmountCents: formMoneyCents(form, 'rentAmount'),
      depositAmountCents: formMoneyCents(form, 'depositAmount'),
      dueDay: formNumber(form, 'dueDay'),
    });
    successorId = successor.id;
  } catch (error) {
    fail(`/leases/${leaseId}`, error);
  }
  revalidatePath(`/leases/${leaseId}`);
  succeed(`/leases/${successorId}`, 'Renewal draft created. Activate it to close the current lease.');
}

export async function terminateLeaseAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  const leaseId = formValue(form, 'leaseId');
  try {
    await terminateLease(db, organizationId, leaseId, {
      endDate: formDate(form, 'endDate'),
      reason: formValue(form, 'reason'),
    });
  } catch (error) {
    fail(`/leases/${leaseId}`, error);
  }
  revalidatePath(`/leases/${leaseId}`);
  revalidatePath('/properties');
  succeed(`/leases/${leaseId}`, 'Lease terminated and unit released.');
}
