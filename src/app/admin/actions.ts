'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createInvitation, invitationPath } from '@/lib/auth/invitations';
import { requireSuperAdmin, setActiveOrganizationCookie } from '@/lib/auth/session';
import { fail, formValue, succeed } from '@/lib/actions/helpers';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function organizationSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

export async function createOrganizationAction(form: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const name = formValue(form, 'name');
  const timezone = formValue(form, 'timezone') || 'UTC';
  const ownerEmail = formValue(form, 'ownerEmail').toLowerCase();

  let invite: string | undefined;
  try {
    if (name.length === 0) throw new Error('An organization name is required.');
    if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
      throw new Error('Enter a valid email address for the owner.');
    }

    const organization = await prisma.organization.create({
      data: { name, timezone, slug: organizationSlug(name) },
    });

    if (ownerEmail) {
      const { token } = await createInvitation({
        organizationId: organization.id,
        email: ownerEmail,
        kind: 'MANAGER',
        role: 'OWNER',
        invitedByUserId: user.id,
      });
      invite = invitationPath(token);
    }
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Organization created.', { invite });
}

export async function inviteOwnerAction(form: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const organizationId = formValue(form, 'organizationId');
  const email = formValue(form, 'email').toLowerCase();

  let invite: string | undefined;
  try {
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new Error('Organization not found.');

    const { token } = await createInvitation({
      organizationId: organization.id,
      email,
      kind: 'MANAGER',
      role: 'OWNER',
      invitedByUserId: user.id,
    });
    invite = invitationPath(token);
  } catch (error) {
    fail('/admin', error);
  }

  revalidatePath('/admin');
  succeed('/admin', 'Owner invitation ready. Share the link below.', { invite });
}

export async function enterOrganizationAction(form: FormData): Promise<void> {
  await requireSuperAdmin();
  const organizationId = formValue(form, 'organizationId');
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) fail('/admin', new Error('Organization not found.'));

  await setActiveOrganizationCookie(organization.id);
  redirect('/dashboard');
}
