import { describe, expect, it } from 'vitest';
import {
  canManageMembers,
  canManageOperations,
  canManagePortfolio,
  canRecordMoney,
  canWorkAssignedJobs,
} from '@/lib/auth/permissions';

describe('role capabilities', () => {
  it('lets only owners manage members', () => {
    expect(canManageMembers('OWNER')).toBe(true);
    expect(canManageMembers('PROPERTY_MANAGER')).toBe(false);
    expect(canManageMembers('STAFF')).toBe(false);
  });

  it('lets owners and property managers run the portfolio', () => {
    expect(canManagePortfolio('OWNER')).toBe(true);
    expect(canManagePortfolio('PROPERTY_MANAGER')).toBe(true);
    expect(canManagePortfolio('STAFF')).toBe(false);
  });

  it('lets staff work on assigned jobs', () => {
    expect(canWorkAssignedJobs('STAFF')).toBe(true);
  });

  it('keeps money recording out of staff hands', () => {
    expect(canRecordMoney('OWNER')).toBe(true);
    expect(canRecordMoney('PROPERTY_MANAGER')).toBe(true);
    expect(canRecordMoney('STAFF')).toBe(false);
  });

  it('treats operations like portfolio management', () => {
    expect(canManageOperations('PROPERTY_MANAGER')).toBe(true);
    expect(canManageOperations('STAFF')).toBe(false);
  });
});
