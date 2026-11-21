'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import { createInvitation, invitationPath, revokeTenantPortal } from '@/lib/auth/invitations';
import {
  archiveTenant,
  createTenant,
  deleteTenant,
  updateTenant,
} from '@/lib/domain/tenants';
import { fail, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

const MANAGER_ROLES = ['OWNER', 'PROPERTY_MANAGER'] as const;

export async function createTenantAction(form: FormData): Promise<void> {
  const { db, organizationId } = await requireManager([...MANAGER_ROLES]);
  try {
    await createTenant(db, organizationId, {
      name: formValue(form, 'name'),
      email: formValue(form, 'email'),
      phone: formOptionalValue(form, 'phone'),
    });
  } catch (error) {
    fail('/tenants', error);
  }
  revalidatePath('/tenants');
  succeed('/tenants', 'Tenant created.');
}

export async function updateTenantAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const tenantId = formValue(form, 'tenantId');
  try {
    await updateTenant(db, tenantId, {
      name: formValue(form, 'name'),
      email: formValue(form, 'email'),
      phone: formOptionalValue(form, 'phone'),
    });
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath(`/tenants/${tenantId}`);
  succeed(`/tenants/${tenantId}`, 'Tenant updated.');
}

export async function archiveTenantAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
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
  const { db } = await requireManager([...MANAGER_ROLES]);
  const tenantId = formValue(form, 'tenantId');
  try {
    await deleteTenant(db, tenantId);
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath('/tenants');
  succeed('/tenants', 'Tenant deleted.');
}

export async function inviteTenantAction(form: FormData): Promise<void> {
  const { db, organizationId, user } = await requireManager([...MANAGER_ROLES]);
  const tenantId = formValue(form, 'tenantId');
  const tenant = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!tenant) {
    fail(`/tenants/${tenantId}`, new Error('Tenant not found.'));
  }

  let path = '';
  let expiry = '';
  try {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tenant.email)) {
      throw new Error('Enter a valid email address for this tenant.');
    }
    if (tenant.portalUserId) throw new Error('This tenant already has portal access.');

    const { token, expiresAt } = await createInvitation({
      organizationId,
      email: tenant.email,
      kind: 'TENANT',
      invitedByUserId: user.id,
      tenantId,
    });

    path = invitationPath(token);
    expiry = expiresAt.toISOString().slice(0, 10);
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }

  revalidatePath(`/tenants/${tenantId}`);
  succeed(
    `/tenants/${tenantId}`,
    `Invitation ready (expires ${expiry}). Share the link below.`,
    { invite: path },
  );
}

export async function revokeTenantAccessAction(form: FormData): Promise<void> {
  const { db } = await requireManager([...MANAGER_ROLES]);
  const tenantId = formValue(form, 'tenantId');
  try {
    await revokeTenantPortal(db, tenantId);
  } catch (error) {
    fail(`/tenants/${tenantId}`, error);
  }
  revalidatePath(`/tenants/${tenantId}`);
  succeed(`/tenants/${tenantId}`, 'Portal access revoked.');
}
