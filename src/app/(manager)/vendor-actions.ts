'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import { createInvitation, invitationPath } from '@/lib/auth/invitations';
import { archiveVendor, updateVendor } from '@/lib/domain/vendors';
import { fail, formOptionalValue, formValue, succeed } from '@/lib/actions/helpers';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function inviteVendorAction(form: FormData): Promise<void> {
  const { ownerUserId, user } = await requireManager();
  const email = formValue(form, 'email').toLowerCase();

  let invite: string | undefined;
  try {
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const { token } = await createInvitation({
      email,
      role: 'VENDOR',
      ownerUserId,
      invitedByUserId: user.id,
    });
    invite = invitationPath(token);
  } catch (error) {
    fail('/vendors', error);
  }

  revalidatePath('/vendors');
  succeed('/vendors', 'Vendor invitation ready. Share the link below.', { invite });
}

export async function updateVendorAction(form: FormData): Promise<void> {
  const { db } = await requireManager();
  const vendorId = formValue(form, 'vendorId');
  try {
    await updateVendor(db, vendorId, {
      name: formValue(form, 'name'),
      company: formOptionalValue(form, 'company'),
      trade: formOptionalValue(form, 'trade'),
      phone: formOptionalValue(form, 'phone'),
    });
  } catch (error) {
    fail(`/vendors/${vendorId}`, error);
  }
  revalidatePath(`/vendors/${vendorId}`);
  succeed(`/vendors/${vendorId}`, 'Vendor updated.');
}

export async function archiveVendorAction(form: FormData): Promise<void> {
  const { db } = await requireManager();
  const vendorId = formValue(form, 'vendorId');
  try {
    await archiveVendor(db, vendorId);
  } catch (error) {
    fail(`/vendors/${vendorId}`, error);
  }
  revalidatePath('/vendors');
  succeed('/vendors', 'Vendor archived.');
}
