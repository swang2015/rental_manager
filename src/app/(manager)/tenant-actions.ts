'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import { createInvitation, invitationPath } from '@/lib/auth/invitations';
import { archiveTenant, deleteTenant, updateTenant } from '@/lib/domain/tenants';
import { fail, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function inviteTenantAction(form: FormData): Promise<void> {
  const { ownerUserId, user } = await requireManager();
  const email = formValue(form, 'email').toLowerCase();

  let invite: string | undefined;
  try {
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const { token } = await createInvitation({
      email,
      role: 'TENANT',
      ownerUserId,
      invitedByUserId: user.id,
    });
    invite = invitationPath(token);
  } catch (error) {
    fail('/tenants', error);
  }

  revalidatePath('/tenants');
  succeed('/tenants', 'Tenant invitation ready. Share the link below.', { invite });
}

export async function updateTenantAction(form: FormData): Promise<void> {
  const { db } = await requireManager();
  const tenantId = formValue(form, 'tenantId');
  try {
    await updateTenant(db, tenantId, {
      name: formValue(form, 'name'),
      phone: formOptionalValue(form, 'phone'),
    });
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath(`/tenants/${tenantId}`);
  succeed(`/tenants/${tenantId}`, 'Tenant updated.');
}

export async function archiveTenantAction(form: FormData): Promise<void> {
  const { db } = await requireManager();
  const tenantId = formValue(form, 'tenantId');
  try {
    await archiveTenant(db, tenantId);
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath('/tenants');
  succeed('/tenants', 'Tenant archived.');
}

export async function deleteTenantAction(form: FormData): Promise<void> {
  const { db } = await requireManager();
  const tenantId = formValue(form, 'tenantId');
  try {
    await deleteTenant(db, tenantId);
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath('/tenants');
  succeed('/tenants', 'Tenant deleted.');
}
