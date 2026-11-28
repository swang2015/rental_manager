'use server';

import { revalidatePath } from 'next/cache';
import { requireVendor } from '@/lib/auth/session';
import { updateVendorWorkOrder } from '@/lib/domain/vendor-portal';
import { fail, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

export async function updateAssignedWorkOrderAction(form: FormData): Promise<void> {
  const context = await requireVendor();
  const workOrderId = formValue(form, 'workOrderId');

  try {
    await updateVendorWorkOrder(context.user.id, workOrderId, {
      status: formValue(form, 'status') as 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      note: formOptionalValue(form, 'note'),
    });
  } catch (error) {
    fail(`/vendor/work-orders/${workOrderId}`, error);
  }

  revalidatePath('/vendor');
  revalidatePath(`/vendor/work-orders/${workOrderId}`);
  succeed(`/vendor/work-orders/${workOrderId}`, 'Work order updated.');
}
