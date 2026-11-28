'use server';

import { revalidatePath } from 'next/cache';
import { requireTenant } from '@/lib/auth/session';
import { createRequest } from '@/lib/domain/maintenance';
import { fail, formValue, succeed } from '@/lib/actions/helpers';

export async function submitRequestAction(form: FormData): Promise<void> {
  const { db, ownerUserId, tenant, user } = await requireTenant();

  let requestId: string;
  try {
    const lease = await db.lease.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    if (!lease) throw new Error('An active lease is required to submit maintenance requests.');

    const request = await createRequest(db, ownerUserId, {
      unitId: lease.unitId,
      tenantId: tenant.id,
      category: formValue(form, 'category'),
      description: formValue(form, 'description'),
      createdByUserId: user.id,
    });
    requestId = request.id;
  } catch (error) {
    fail('/portal/maintenance', error);
  }

  revalidatePath('/portal/maintenance');
  succeed(`/portal/maintenance/${requestId}`, 'Request submitted.');
}

export async function updatePhoneAction(form: FormData): Promise<void> {
  const { db, tenant } = await requireTenant();
  try {
    await db.tenant.updateMany({
      where: { id: tenant.id },
      data: { phone: formValue(form, 'phone') || null },
    });
  } catch (error) {
    fail('/portal/contact', error);
  }
  revalidatePath('/portal/contact');
  succeed('/portal/contact', 'Phone number updated.');
}
