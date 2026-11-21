import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginRateLimit,
} from '@/lib/auth/rate-limit';

describe('login rate limiting', () => {
  beforeEach(() => resetLoginRateLimit());

  it('allows five attempts then blocks', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(checkLoginAllowed('user@example.test', now).allowed).toBe(true);
      recordLoginFailure('user@example.test', now);
    }
    const blocked = checkLoginAllowed('user@example.test', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('is case insensitive on the email', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) recordLoginFailure('USER@example.test', now);
    expect(checkLoginAllowed('user@example.test', now).allowed).toBe(false);
  });

  it('clears the window after the lockout period', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) recordLoginFailure('user@example.test', now);
    expect(checkLoginAllowed('user@example.test', now + 16 * 60 * 1000).allowed).toBe(true);
  });

  it('forgets failures after a successful sign-in', () => {
    const now = 1_000_000;
    recordLoginFailure('user@example.test', now);
    clearLoginFailures('user@example.test');
    expect(checkLoginAllowed('user@example.test', now).allowed).toBe(true);
  });
});
