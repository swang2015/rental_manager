'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionUser, homePathForUser } from '@/lib/auth/session';
import { acceptInvitation } from '@/lib/auth/invitations';
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure } from '@/lib/auth/rate-limit';
import { fail, formValue } from '@/lib/actions/helpers';

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

export async function signUpAction(form: FormData): Promise<void> {
  const name = formValue(form, 'name');
  const email = formValue(form, 'email').toLowerCase();
  const password = formValue(form, 'password');
  const organizationName = formValue(form, 'organizationName');
  const timezone = formValue(form, 'timezone') || 'UTC';

  try {
    if (name.length === 0) throw new Error('Your name is required.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Use at least 8 characters for the password.');
    if (organizationName.length === 0) throw new Error('An organization name is required.');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('An account with that email already exists. Sign in instead.');

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        memberships: {
          create: {
            role: 'OWNER',
            status: 'ACTIVE',
            organization: {
              create: { name: organizationName, slug: slugify(organizationName), timezone },
            },
          },
        },
      },
    });

    await createSession(user.id);
  } catch (error) {
    fail('/sign-up', error);
  }

  redirect('/dashboard');
}

export async function signInAction(form: FormData): Promise<void> {
  const email = formValue(form, 'email').toLowerCase();
  const password = formValue(form, 'password');
  const returnTo = formValue(form, 'returnTo') || '/';

  const limit = checkLoginAllowed(email);
  if (!limit.allowed) {
    fail('/sign-in', new Error(`Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`));
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || !valid) {
    recordLoginFailure(email);
    fail('/sign-in', new Error('The email or password is incorrect.'), { returnTo });
  }

  clearLoginFailures(email);
  await createSession(user.id);

  const sessionUser = await getSessionUser();
  redirect(returnTo !== '/' ? returnTo : sessionUser ? homePathForUser(sessionUser) : '/');
}

export async function acceptInvitationAction(form: FormData): Promise<void> {
  const token = formValue(form, 'token');
  const name = formValue(form, 'name');
  const password = formValue(form, 'password');

  let result: { userId: string; homePath: string };
  try {
    result = await acceptInvitation({ token, name, password });
  } catch (error) {
    fail(`/accept-invitation/${token}`, error);
  }

  await createSession(result.userId);
  redirect(result.homePath);
}
