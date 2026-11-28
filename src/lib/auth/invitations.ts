import { randomBytes } from 'node:crypto';
import type { UserRoleType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/session';
import { assertCondition, assertFound } from '@/lib/domain/errors';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CreateInvitationInput = {
  email: string;
  role: UserRoleType;
  invitedByUserId: string;
  /** For TENANT/VENDOR invitations: the owner the record will belong to. */
  ownerUserId?: string | null;
};

export function invitationPath(token: string): string {
  return `/accept-invitation/${token}`;
}

export async function createInvitation(input: CreateInvitationInput) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const email = input.email.trim().toLowerCase();

  assertCondition(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'Enter a valid email address.');
  if (input.role === 'TENANT' || input.role === 'VENDOR') {
    assertCondition(Boolean(input.ownerUserId), 'An owner is required for this invitation.');
  }

  await prisma.invitation.create({
    data: {
      email,
      role: input.role,
      ownerUserId: input.ownerUserId ?? null,
      tokenHash: hashToken(token),
      expiresAt,
      invitedByUserId: input.invitedByUserId,
    },
  });

  return { token, expiresAt };
}

export async function findInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { owner: true, invitedBy: true },
  });
}

export type InvitationView = NonNullable<Awaited<ReturnType<typeof findInvitationByToken>>>;

export function invitationIsUsable(
  invitation: InvitationView | null,
): invitation is InvitationView {
  return Boolean(
    invitation && !invitation.acceptedAt && invitation.expiresAt.getTime() > Date.now(),
  );
}

function homePathForRole(role: UserRoleType): string {
  if (role === 'OWNER') return '/dashboard';
  if (role === 'VENDOR') return '/vendor';
  return '/portal';
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  name: string;
}): Promise<{ userId: string; homePath: string; role: UserRoleType }> {
  const invitation = await findInvitationByToken(input.token);
  const valid = assertFound(invitation, 'This invitation is no longer valid.');
  assertCondition(!valid.acceptedAt, 'This invitation has already been accepted.', 'invalid_state');
  assertCondition(
    valid.expiresAt.getTime() > Date.now(),
    'This invitation has expired. Ask for a new one.',
    'invalid_state',
  );

  const email = valid.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    assertCondition(user.status !== 'DISABLED', 'This account is disabled.', 'forbidden');
    const matches = await verifyPassword(user.passwordHash, input.password);
    assertCondition(matches, 'The password does not match the existing account.', 'forbidden');
  } else {
    assertCondition(input.password.length >= 8, 'Use at least 8 characters for the password.');
    user = await prisma.user.create({
      data: {
        email,
        name: input.name.trim() || email.split('@')[0],
        passwordHash: await hashPassword(input.password),
        status: 'ACTIVE',
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.invitation.findUnique({ where: { id: valid.id } });
    assertCondition(
      fresh && !fresh.acceptedAt,
      'This invitation has already been accepted.',
      'invalid_state',
    );

    await tx.userRole.upsert({
      where: { userId_role: { userId: user.id, role: valid.role } },
      create: { userId: user.id, role: valid.role },
      update: {},
    });

    if (valid.role === 'TENANT') {
      const ownerUserId = assertFound(valid.ownerUserId, 'The invitation is missing its owner.');
      await tx.tenant.upsert({
        where: { ownerUserId_userId: { ownerUserId, userId: user.id } },
        create: {
          ownerUserId,
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        update: { status: 'ACTIVE' },
      });
    }

    if (valid.role === 'VENDOR') {
      const ownerUserId = assertFound(valid.ownerUserId, 'The invitation is missing its owner.');
      await tx.vendor.upsert({
        where: { ownerUserId_userId: { ownerUserId, userId: user.id } },
        create: {
          ownerUserId,
          userId: user.id,
          name: user.name,
          phone: user.phone,
        },
        update: { status: 'ACTIVE' },
      });
    }

    if (user.status === 'PENDING') {
      await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    }

    await tx.invitation.update({ where: { id: valid.id }, data: { acceptedAt: new Date() } });
  });

  return { userId: user.id, homePath: homePathForRole(valid.role), role: valid.role };
}
