'use server';

import type { UserRoleType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createInvitation, invitationPath } from '@/lib/auth/invitations';
import { requireSuperAdmin, setActiveOwnerCookie } from '@/lib/auth/session';
import { archiveVendor, updateVendor } from '@/lib/domain/vendors';
import { fail, formValue, succeed } from '@/lib/actions/helpers';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLES: UserRoleType[] = ['OWNER', 'TENANT', 'VENDOR'];

export async function approveUserAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const userId = formValue(form, 'userId');
  const role = formValue(form, 'role') as UserRoleType;

  try {
    if (!ROLES.includes(role)) throw new Error('Choose a role.');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Account not found.');
    if (user.status !== 'PENDING') throw new Error('This account is not awaiting review.');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', requestedRole: null },
      }),
      prisma.userRole.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role },
        update: {},
      }),
      // Vendor accounts need a directory entry so owners can assign work.
      ...(role === 'VENDOR'
        ? [
            prisma.vendor.upsert({
              where: { userId },
              create: { userId, name: user.name, phone: user.phone },
              update: { status: 'ACTIVE' },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Account approved.');
}

export async function rejectUserAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const userId = formValue(form, 'userId');
  try {
    const result = await prisma.user.deleteMany({ where: { id: userId, status: 'PENDING' } });
    if (result.count === 0) throw new Error('Only pending accounts can be rejected.');
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Account request rejected.');
}

export async function inviteOwnerAction(form: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const email = formValue(form, 'email').toLowerCase();

  let invite: string | undefined;
  try {
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
    if (existing?.roles.some((role) => role.role === 'OWNER')) {
      throw new Error('That email already owns properties on RentEase.');
    }

    const { token } = await createInvitation({
      email,
      role: 'OWNER',
      invitedByUserId: admin.id,
    });
    invite = invitationPath(token);
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Owner invitation ready. Share the link below.', { invite });
}

export async function enterOwnerAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const ownerUserId = formValue(form, 'ownerUserId');
  const owner = await prisma.user.findFirst({
    where: { id: ownerUserId, roles: { some: { role: 'OWNER' } } },
  });
  if (!owner) fail('/admin', new Error('Owner not found.'));

  await setActiveOwnerCookie(owner.id);
  redirect('/dashboard');
}

export async function inviteVendorAction(form: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const email = formValue(form, 'email').toLowerCase();

  let invite: string | undefined;
  try {
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const { token } = await createInvitation({
      email,
      role: 'VENDOR',
      invitedByUserId: admin.id,
    });
    invite = invitationPath(token);
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Vendor invitation ready. Share the link below.', { invite });
}

export async function updateVendorAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const vendorId = formValue(form, 'vendorId');
  try {
    await updateVendor(vendorId, {
      name: formValue(form, 'name'),
      company: formValue(form, 'company') || null,
      trade: formValue(form, 'trade') || null,
      phone: formValue(form, 'phone') || null,
    });
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Vendor updated.');
}

export async function archiveVendorAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const vendorId = formValue(form, 'vendorId');
  try {
    await archiveVendor(vendorId);
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Vendor archived.');
}
