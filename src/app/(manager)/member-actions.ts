'use server';

import type { MembershipRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import { createInvitation, invitationPath } from '@/lib/auth/invitations';
import { changeMemberRole, setMemberStatus } from '@/lib/domain/members';
import { fail, formValue, succeed } from '@/lib/actions/helpers';

export async function inviteManagerAction(form: FormData): Promise<void> {
  const { organizationId, user } = await requireManager(['OWNER']);
  const email = formValue(form, 'email').toLowerCase();
  const role = formValue(form, 'role') as MembershipRole;

  let path = '';
  let expiry = '';
  try {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (!['OWNER', 'PROPERTY_MANAGER', 'STAFF'].includes(role)) throw new Error('Choose a role.');
    const { token, expiresAt } = await createInvitation({
      organizationId,
      email,
      kind: 'MANAGER',
      role,
      invitedByUserId: user.id,
    });
    path = invitationPath(token);
    expiry = expiresAt.toISOString().slice(0, 10);
  } catch (error) {
    fail('/members', error);
  }
  revalidatePath('/members');
  succeed('/members', `Invitation ready for ${email} (expires ${expiry}). Share the link below.`, { invite: path });
}

export async function changeMemberRoleAction(form: FormData): Promise<void> {
  const { db } = await requireManager(['OWNER']);
  try {
    await changeMemberRole(db, formValue(form, 'membershipId'), formValue(form, 'role') as MembershipRole);
  } catch (error) {
    fail('/members', error);
  }
  revalidatePath('/members');
  succeed('/members', 'Member role updated.');
}

export async function setMemberStatusAction(form: FormData): Promise<void> {
  const { db } = await requireManager(['OWNER']);
  try {
    await setMemberStatus(db, formValue(form, 'membershipId'), formValue(form, 'active') === 'true');
  } catch (error) {
    fail('/members', error);
  }
  revalidatePath('/members');
  succeed('/members', 'Member updated.');
}
