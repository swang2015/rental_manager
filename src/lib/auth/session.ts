import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import type { ManagerRole } from '@/lib/auth/permissions';

const SESSION_COOKIE = 'rm_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { organization: true },
            orderBy: { createdAt: 'asc' },
          },
          tenantRecords: {
            where: { status: 'ACTIVE' },
            include: { organization: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export function homePathForUser(user: SessionUser): string {
  if (user.memberships.length > 0) return '/dashboard';
  if (user.tenantRecords.length > 0) return '/portal';
  return '/onboarding';
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function getManagerContext() {
  const user = await getSessionUser();
  if (!user) return null;
  const membership = user.memberships[0];
  if (!membership) return null;
  return {
    user,
    membership,
    organization: membership.organization,
    organizationId: membership.organizationId,
    db: scopedDb(membership.organizationId),
  };
}

export async function requireManager(allowedRoles?: ManagerRole[]) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const membership = user.memberships[0];
  if (!membership) {
    if (user.tenantRecords.length > 0) redirect('/portal');
    redirect('/onboarding');
  }

  if (allowedRoles && !allowedRoles.includes(membership.role as ManagerRole)) {
    redirect('/dashboard?error=You%20do%20not%20have%20permission%20for%20that%20action');
  }

  return {
    user,
    membership,
    organization: membership.organization,
    organizationId: membership.organizationId,
    db: scopedDb(membership.organizationId),
  };
}

export async function getTenantContext() {
  const user = await getSessionUser();
  if (!user) return null;
  const tenant = user.tenantRecords[0];
  if (!tenant) return null;
  return {
    user,
    tenant,
    organization: tenant.organization,
    organizationId: tenant.organizationId,
    db: scopedDb(tenant.organizationId),
  };
}

export async function requireTenant() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const tenant = user.tenantRecords[0];
  if (!tenant) {
    if (user.memberships.length > 0) redirect('/dashboard');
    redirect('/onboarding');
  }

  return {
    user,
    tenant,
    organization: tenant.organization,
    organizationId: tenant.organizationId,
    db: scopedDb(tenant.organizationId),
  };
}
