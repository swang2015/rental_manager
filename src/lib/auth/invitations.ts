import { randomBytes } from 'node:crypto';
import type { InvitationKind, MembershipRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/session';
import { DomainError, assertCondition, assertFound } from '@/lib/domain/errors';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CreateInvitationInput = {
  organizationId: string;
  email: string;
  kind: InvitationKind;
  invitedByUserId: string;
  role?: MembershipRole;
  tenantId?: string;
};

export function invitationPath(token: string): string {
  return `/accept-invitation/${token}`;
}

export async function createInvitation(input: CreateInvitationInput) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.invitation.create({
      data: {
        organizationId: input.organizationId,
        email: input.email.trim().toLowerCase(),
        kind: input.kind,
        role: input.kind === 'MANAGER' ? (input.role ?? 'STAFF') : null,
        tenantId: input.kind === 'TENANT' ? (input.tenantId ?? null) : null,
        tokenHash: hashToken(token),
        expiresAt,
        invitedByUserId: input.invitedByUserId,
      },
    });
  });

  return { token, expiresAt };
}

export async function findInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true, tenant: true },
  });
}

export type InvitationView = NonNullable<Awaited<ReturnType<typeof findInvitationByToken>>>;

export function invitationIsUsable(invitation: InvitationView | null): invitation is InvitationView {
  return Boolean(
    invitation && !invitation.acceptedAt && invitation.expiresAt.getTime() > Date.now(),
  );
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  name: string;
}): Promise<{ userId: string; homePath: string }> {
  const invitation = await findInvitationByToken(input.token);
  const valid = assertFound(invitation, 'This invitation is no longer valid.');
  assertCondition(!valid.acceptedAt, 'This invitation has already been accepted.', 'invalid_state');
  assertCondition(
    valid.expiresAt.getTime() > Date.now(),
    'This invitation has expired. Ask the manager for a new one.',
    'invalid_state',
  );

  const email = valid.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const matches = await verifyPassword(user.passwordHash, input.password);
    assertCondition(matches, 'The password does not match the existing account.', 'forbidden');
  } else {
    assertCondition(input.password.length >= 8, 'Use at least 8 characters for the password.');
    user = await prisma.user.create({
      data: {
        email,
        name: input.name.trim() || email.split('@')[0],
        passwordHash: await hashPassword(input.password),
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.invitation.findUnique({ where: { id: valid.id } });
    assertCondition(fresh && !fresh.acceptedAt, 'This invitation has already been accepted.', 'invalid_state');

    if (valid.kind === 'MANAGER') {
      assertCondition(Boolean(valid.role), 'The invitation is missing a role.');
      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: valid.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: valid.organizationId,
          userId: user.id,
          role: valid.role!,
          status: 'ACTIVE',
        },
        update: { role: valid.role!, status: 'ACTIVE' },
      });
    } else {
      const tenant = await tx.tenant.findFirst({
        where: { id: valid.tenantId ?? '', organizationId: valid.organizationId },
      });
      const foundTenant = assertFound(tenant, 'The tenant record for this invitation no longer exists.');
      assertCondition(
        !foundTenant.portalUserId || foundTenant.portalUserId === user.id,
        'This tenant record is already linked to another account.',
        'conflict',
      );
      await tx.tenant.updateMany({
        where: { id: foundTenant.id, organizationId: valid.organizationId },
        data: { portalUserId: user.id },
      });
    }

    await tx.invitation.update({
      where: { id: valid.id },
      data: { acceptedAt: new Date() },
    });
  });

  return { userId: user.id, homePath: valid.kind === 'MANAGER' ? '/dashboard' : '/portal' };
}

export async function revokeTenantPortal(
  db: ReturnType<typeof import('@/lib/db/scoped').scopedDb>,
  tenantId: string,
): Promise<void> {
  const result = await db.tenant.updateMany({
    where: { id: tenantId, portalUserId: { not: null } },
    data: { portalUserId: null },
  });
  if (result.count === 0) {
    throw new DomainError('This tenant has no active portal access.', 'not_found');
  }
  await db.invitation.deleteMany({ where: { tenantId, kind: 'TENANT', acceptedAt: null } });
}
