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

const MANAGER_ROLES = ['OWNER', 'PROPERTY_MANAGER'] as const;

export async function createRequestOnBehalfAction(form: FormData): Promise<void> {
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  let requestId: string;
  try {
    const request = await createRequest(db, organizationId, {
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
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  const requestId = formValue(form, 'requestId');
  try {
    await triageRequest(db, organizationId, requestId, {
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
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  const requestId = formValue(form, 'requestId');
  try {
    await createWorkOrder(db, organizationId, requestId, {
      assigneeMembershipId: formValue(form, 'assigneeMembershipId'),
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
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  const requestId = formValue(form, 'requestId');
  try {
    await reassignWorkOrder(db, organizationId, formValue(form, 'workOrderId'), {
      assigneeMembershipId: formValue(form, 'assigneeMembershipId'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Work order reassigned.');
}

export async function updateWorkOrderStatusAction(form: FormData): Promise<void> {
  const context = await requireManager();
  const requestId = formValue(form, 'requestId');
  const workOrderId = formValue(form, 'workOrderId');

  try {
    if (context.membership.role === 'STAFF') {
      const workOrder = await context.db.workOrder.findFirst({ where: { id: workOrderId } });
      if (!workOrder || workOrder.assigneeMembershipId !== context.membership.id) {
        throw new Error('Only the assigned staff member can update this work order.');
      }
    } else if (!MANAGER_ROLES.includes(context.membership.role as (typeof MANAGER_ROLES)[number])) {
      throw new Error('You do not have permission to update work orders.');
    }

    await updateWorkOrderStatus(context.db, context.organizationId, workOrderId, {
      status: formValue(form, 'status') as 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      note: formOptionalValue(form, 'note'),
      actorUserId: context.user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Work order updated.');
}

export async function cancelRequestAction(form: FormData): Promise<void> {
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  const requestId = formValue(form, 'requestId');
  try {
    await cancelRequest(db, organizationId, requestId, {
      reason: formValue(form, 'reason'),
      actorUserId: user.id,
    });
  } catch (error) {
    fail(`/maintenance/${requestId}`, error);
  }
  revalidatePath(`/maintenance/${requestId}`);
  succeed(`/maintenance/${requestId}`, 'Request cancelled.');
}
