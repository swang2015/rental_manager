import { createHash, randomBytes } from 'node:crypto';
import type { Organization } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import type { ManagerRole } from '@/lib/auth/permissions';

const SESSION_COOKIE = 'rm_session';
/** Organization a superadmin is currently working inside. */
export const ACTIVE_ORG_COOKIE = 'rm_org';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_ORG_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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
  store.delete(ACTIVE_ORG_COOKIE);
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
  if (user.isSuperAdmin) return '/admin';
  if (user.memberships.length > 0) return '/dashboard';
  if (user.tenantRecords.length > 0) return '/portal';
  return '/onboarding';
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  return user;
}

async function selectedOrganizationForSuperAdmin(): Promise<Organization | null> {
  const store = await cookies();
  const selectedId = store.get(ACTIVE_ORG_COOKIE)?.value;
  if (selectedId) {
    const selected = await prisma.organization.findUnique({ where: { id: selectedId } });
    if (selected) return selected;
  }
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
}

function superAdminContext(user: SessionUser, organization: Organization) {
  return {
    user,
    membership: {
      id: `superadmin:${organization.id}`,
      role: 'OWNER' as ManagerRole,
      status: 'ACTIVE' as const,
      organizationId: organization.id,
      userId: user.id,
      organization,
    },
    organization,
    organizationId: organization.id,
    db: scopedDb(organization.id),
    isSuperAdmin: true,
  };
}

export async function setActiveOrganizationCookie(organizationId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: ACTIVE_ORG_MAX_AGE_SECONDS,
  });
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  if (!user.isSuperAdmin) {
    if (user.memberships.length > 0) redirect('/dashboard');
    if (user.tenantRecords.length > 0) redirect('/portal');
    redirect('/onboarding');
  }
  return user;
}

export async function getManagerContext() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.isSuperAdmin) {
    const organization = await selectedOrganizationForSuperAdmin();
    if (!organization) return null;
    return superAdminContext(user, organization);
  }

  const membership = user.memberships[0];
  if (!membership) return null;
  return {
    user,
    membership,
    organization: membership.organization,
    organizationId: membership.organizationId,
    db: scopedDb(membership.organizationId),
    isSuperAdmin: false,
  };
}

export async function requireManager(allowedRoles?: ManagerRole[]) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  // A superadmin can work inside any organization with full permissions.
  if (user.isSuperAdmin) {
    const organization = await selectedOrganizationForSuperAdmin();
    if (!organization) redirect('/admin');
    return superAdminContext(user, organization);
  }

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
    isSuperAdmin: false,
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
