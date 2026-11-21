'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { fail, formValue } from '@/lib/actions/helpers';

export async function createOrganizationAction(form: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const name = formValue(form, 'name');
  const timezone = formValue(form, 'timezone') || 'UTC';

  try {
    if (name.length === 0) throw new Error('An organization name is required.');
    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);

    await prisma.organization.create({
      data: {
        name,
        timezone,
        slug: `${slugBase || 'org'}-${randomBytes(3).toString('hex')}`,
        memberships: {
          create: { userId: user.id, role: 'OWNER', status: 'ACTIVE' },
        },
      },
    });
  } catch (error) {
    fail('/onboarding', error);
  }

  redirect('/dashboard');
}
