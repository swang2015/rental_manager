import type { MembershipRole } from '@prisma/client';
import type { ScopedDb } from '@/lib/db/scoped';
import { assertCondition, assertFound } from '@/lib/domain/errors';

export function listMembers(db: ScopedDb) {
  return db.membership.findMany({
    include: { user: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function changeMemberRole(db: ScopedDb, membershipId: string, role: MembershipRole) {
  const membership = assertFound(
    await db.membership.findFirst({ where: { id: membershipId } }),
    'Member not found.',
  );

  if (membership.role === 'OWNER' && role !== 'OWNER') {
    const owners = await db.membership.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
    assertCondition(owners > 1, 'An organization must keep at least one owner.');
  }

  await db.membership.updateMany({
    where: { id: membershipId },
    data: { role },
  });
}

export async function setMemberStatus(db: ScopedDb, membershipId: string, active: boolean) {
  const membership = assertFound(
    await db.membership.findFirst({ where: { id: membershipId } }),
    'Member not found.',
  );
  if (membership.role === 'OWNER' && !active) {
    const owners = await db.membership.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
    assertCondition(owners > 1, 'An organization must keep at least one active owner.');
  }
  await db.membership.updateMany({
    where: { id: membershipId },
    data: { status: active ? 'ACTIVE' : 'DISABLED' },
  });
}
