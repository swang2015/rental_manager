import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 exposes These as an ambient const enum, which cannot be
// imported under `isolatedModules`; 2 is Argon2id.
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}
