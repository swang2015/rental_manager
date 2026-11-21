import { argon2idAsync } from '@noble/hashes/argon2.js';

// Argon2id (RFC 9106) with the same cost parameters used previously, so
// existing PHC-encoded hashes remain verifiable. @noble/hashes is pure
// JavaScript, which matters on Cloudflare Workers: runtime WebAssembly
// compilation from a buffer is blocked, so WASM-based KDFs cannot be used.
const VERSION = 0x13;
const PARAMS = { t: 2, m: 19_456, p: 1, dkLen: 32 } as const;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, '');
}

function fromBase64(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function encode(salt: Uint8Array, derived: Uint8Array): string {
  return `$argon2id$v=${VERSION}$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await argon2idAsync(new TextEncoder().encode(password), salt, {
    t: PARAMS.t,
    m: PARAMS.m,
    p: PARAMS.p,
    dkLen: PARAMS.dkLen,
    version: VERSION,
  });
  return encode(salt, derived);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    const parts = passwordHash.split('$');
    if (parts.length !== 6 || parts[1] !== 'argon2id' || parts[2] !== `v=${VERSION}`) {
      return false;
    }

    const params = Object.fromEntries(
      parts[3].split(',').map((pair) => pair.split('=') as [string, string]),
    );
    const m = Number(params.m);
    const t = Number(params.t);
    const p = Number(params.p);
    if (!Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(p)) return false;

    const salt = fromBase64(parts[4]);
    const expected = fromBase64(parts[5]);
    const derived = await argon2idAsync(new TextEncoder().encode(password), salt, {
      t,
      m,
      p,
      dkLen: expected.length,
      version: VERSION,
    });

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
