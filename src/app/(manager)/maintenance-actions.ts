'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import {
  cancelRequest,
  createRequest,
  createWorkOrder,
  reassignWorkOrder,
  triageRequest,
  updateWorkOrderStatus,
} from '@/lib/domain/maintenance';
import { fail, formDate, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

export async function createRequestOnBehalfAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  let requestId: string;
  try {
    const request = await createRequest(db, ownerUserId, {
      tenantId: formValue(form, 'tenantId'),
      unitId: formValue(form, 'unitId'),
      category: formValue(form, 'category'),
      description: formValue(form, 'description'),
      priority: formValue(form, 'priority') as 'LOW' | 'MEDIUM' | 'URGENT',
      createdByUserId: user.id,
    });
    requestId = request.id;
  } catch (error) {
    fail('/maintenance', error);
  }
  revalidatePath('/maintenance');
  succeed(`/maintenance/${requestId}`, 'Request created.');
}

export async function triageRequestAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const requestId = formValue(form, 'requestId');
  try {
    await triageRequest(db, ownerUserId, requestId, {
      priority: formValue(form, 'priority') as 'LOW' | 'MEDIUM' | 'URGENT',
      note: formOptionalValue(form, 'note'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Priority updated.');
}

export async function createWorkOrderAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const requestId = formValue(form, 'requestId');
  try {
    await createWorkOrder(db, ownerUserId, requestId, {
      vendorId: formValue(form, 'vendorId'),
      scheduledFor: formDate(form, 'scheduledFor'),
      actorUserId: user.id,
      note: formOptionalValue(form, 'note'),
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Work order assigned.');
}

export async function reassignWorkOrderAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const requestId = formValue(form, 'requestId');
  try {
    await reassignWorkOrder(db, ownerUserId, formValue(form, 'workOrderId'), {
      vendorId: formValue(form, 'vendorId'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Work order reassigned.');
}

export async function updateWorkOrderStatusAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const requestId = formValue(form, 'requestId');
  const workOrderId = formValue(form, 'workOrderId');

  try {
    await updateWorkOrderStatus(db, ownerUserId, workOrderId, {
      status: formValue(form, 'status') as 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      note: formOptionalValue(form, 'note'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Work order updated.');
}

export async function cancelRequestAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const requestId = formValue(form, 'requestId');
  try {
    await cancelRequest(db, ownerUserId, requestId, {
      reason: formValue(form, 'reason'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Request cancelled.');
}
