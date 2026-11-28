import { createHash, randomBytes } from 'node:crypto';
import type { UserRoleType } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';

const SESSION_COOKIE = 'rm_session';
/** Owner whose portfolio a superadmin is currently working inside. */
export const ACTIVE_OWNER_COOKIE = 'rm_owner';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_OWNER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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
  store.delete(ACTIVE_OWNER_COOKIE);
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
          roles: true,
          tenancies: {
            where: { status: 'ACTIVE' },
            include: { owner: true },
            orderBy: { createdAt: 'asc' },
          },
          vendors: {
            where: { status: 'ACTIVE' },
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
  if (session.user.status === 'DISABLED') return null;
  return session.user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export function hasRole(user: SessionUser, role: UserRoleType): boolean {
  return user.roles.some((entry) => entry.role === role);
}

export function homePathForUser(user: SessionUser): string {
  if (user.isSuperAdmin) return '/admin';
  if (hasRole(user, 'OWNER')) return '/dashboard';
  if (hasRole(user, 'VENDOR')) return '/vendor';
  if (hasRole(user, 'TENANT')) return '/portal';
  return '/onboarding';
}

async function selectedOwnerForSuperAdmin() {
  const store = await cookies();
  const selectedId = store.get(ACTIVE_OWNER_COOKIE)?.value;
  if (selectedId) {
    const selected = await prisma.user.findFirst({
      where: { id: selectedId, roles: { some: { role: 'OWNER' } } },
    });
    if (selected) return selected;
  }
  return prisma.user.findFirst({
    where: { roles: { some: { role: 'OWNER' } }, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
}

function ownerContext(
  user: SessionUser,
  owner: NonNullable<Awaited<ReturnType<typeof selectedOwnerForSuperAdmin>>>,
) {
  return {
    user,
    owner,
    ownerUserId: owner.id,
    timezone: owner.timezone,
    db: scopedDb(owner.id),
    isSuperAdmin: user.isSuperAdmin,
  };
}

export async function setActiveOwnerCookie(ownerUserId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_OWNER_COOKIE, ownerUserId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: ACTIVE_OWNER_MAX_AGE_SECONDS,
  });
}

/** Owners (and superadmins acting as an owner) working in the manager workspace. */
export async function requireManager() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  if (user.isSuperAdmin) {
    const owner = await selectedOwnerForSuperAdmin();
    if (!owner) redirect('/admin');
    return ownerContext(user, owner);
  }

  if (!hasRole(user, 'OWNER')) {
    if (hasRole(user, 'VENDOR') && user.vendors.length > 0) redirect('/vendor');
    if (hasRole(user, 'TENANT') && user.tenancies.length > 0) redirect('/portal');
    redirect('/onboarding');
  }

  return ownerContext(user, user);
}

export async function requireTenant() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  if (!hasRole(user, 'TENANT') || user.tenancies.length === 0) {
    if (user.isSuperAdmin) redirect('/admin');
    if (hasRole(user, 'OWNER')) redirect('/dashboard');
    if (hasRole(user, 'VENDOR') && user.vendors.length > 0) redirect('/vendor');
    redirect('/onboarding');
  }

  const tenant = user.tenancies[0];
  return {
    user,
    tenant,
    owner: tenant.owner,
    ownerUserId: tenant.ownerUserId,
    timezone: tenant.owner.timezone,
    db: scopedDb(tenant.ownerUserId),
  };
}

export async function requireVendor() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  if (!hasRole(user, 'VENDOR') || user.vendors.length === 0) {
    if (user.isSuperAdmin) redirect('/admin');
    if (hasRole(user, 'OWNER')) redirect('/dashboard');
    if (hasRole(user, 'TENANT') && user.tenancies.length > 0) redirect('/portal');
    redirect('/onboarding');
  }

  const vendor = user.vendors[0];
  return {
    user,
    vendor,
    vendorIds: user.vendors.map((entry) => entry.id),
  };
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  if (!user.isSuperAdmin) {
    if (hasRole(user, 'OWNER')) redirect('/dashboard');
    if (hasRole(user, 'VENDOR') && user.vendors.length > 0) redirect('/vendor');
    if (hasRole(user, 'TENANT') && user.tenancies.length > 0) redirect('/portal');
    redirect('/onboarding');
  }
  return user;
}
