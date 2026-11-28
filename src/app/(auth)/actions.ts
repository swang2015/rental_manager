'use server';

import type { UserRoleType } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionUser, homePathForUser } from '@/lib/auth/session';
import { acceptInvitation } from '@/lib/auth/invitations';
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure } from '@/lib/auth/rate-limit';
import { fail, formValue } from '@/lib/actions/helpers';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const APPLICANT_ROLES: UserRoleType[] = ['OWNER', 'TENANT', 'VENDOR'];

export async function signUpAction(form: FormData): Promise<void> {
  const name = formValue(form, 'name');
  const email = formValue(form, 'email').toLowerCase();
  const password = formValue(form, 'password');
  const phone = formValue(form, 'phone') || null;
  const requestedRole = formValue(form, 'requestedRole') as UserRoleType;
  const timezone = formValue(form, 'timezone') || 'UTC';

  let destination = '/onboarding';
  let userId = '';
  try {
    if (name.length === 0) throw new Error('Your name is required.');
    if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Use at least 8 characters for the password.');

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing)
          throw new Error('An account with that email already exists. Sign in instead.');

        const users = await tx.user.count();

        // Only the very first account becomes the platform administrator.
        if (users === 0) {
          const admin = await tx.user.create({
            data: { name, email, passwordHash, timezone, isSuperAdmin: true, status: 'ACTIVE' },
          });
          userId = admin.id;
          destination = '/admin';
          return;
        }

        if (!APPLICANT_ROLES.includes(requestedRole))
          throw new Error('Choose how you will use RentEase.');

        const applicant = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            phone,
            timezone,
            status: 'PENDING',
            requestedRole,
          },
        });
        userId = applicant.id;
        destination = '/onboarding';
      },
      { isolationLevel: 'Serializable' },
    );

    await createSession(userId);
  } catch (error) {
    fail('/sign-up', error);
  }

  redirect(destination);
}

export async function signInAction(form: FormData): Promise<void> {
  const email = formValue(form, 'email').toLowerCase();
  const password = formValue(form, 'password');
  const returnTo = formValue(form, 'returnTo') || '/';

  const limit = checkLoginAllowed(email);
  if (!limit.allowed) {
    fail(
      '/sign-in',
      new Error(`Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`),
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid =
    user && user.status !== 'DISABLED' ? await verifyPassword(user.passwordHash, password) : false;

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
