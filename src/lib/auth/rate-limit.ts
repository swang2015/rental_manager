const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Attempt = { count: number; firstAt: number };

const attempts = new Map<string, Attempt>();

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function checkLoginAllowed(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const entry = attempts.get(normalizeKey(key));
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };

  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(normalizeKey(key));
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count < MAX_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0 };

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 1000),
  };
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const normalized = normalizeKey(key);
  const entry = attempts.get(normalized);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(normalized, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(normalizeKey(key));
}

export function resetLoginRateLimit(): void {
  attempts.clear();
}
