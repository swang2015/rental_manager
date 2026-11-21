export type ManagerRole = 'OWNER' | 'PROPERTY_MANAGER' | 'STAFF';
export type PrincipalKind = 'manager' | 'tenant';

export const ROLE_LABELS: Record<ManagerRole, string> = {
  OWNER: 'Owner',
  PROPERTY_MANAGER: 'Property manager',
  STAFF: 'Staff',
};

const MEMBER_MANAGEMENT_ROLES: ManagerRole[] = ['OWNER'];
const PORTFOLIO_ROLES: ManagerRole[] = ['OWNER', 'PROPERTY_MANAGER'];
const WORK_ROLES: ManagerRole[] = ['OWNER', 'PROPERTY_MANAGER', 'STAFF'];

export function canManageMembers(role: ManagerRole): boolean {
  return MEMBER_MANAGEMENT_ROLES.includes(role);
}

export function canManagePortfolio(role: ManagerRole): boolean {
  return PORTFOLIO_ROLES.includes(role);
}

export function canManageOperations(role: ManagerRole): boolean {
  return PORTFOLIO_ROLES.includes(role);
}

export function canWorkAssignedJobs(role: ManagerRole): boolean {
  return WORK_ROLES.includes(role);
}

export function canRecordMoney(role: ManagerRole): boolean {
  return PORTFOLIO_ROLES.includes(role);
}
