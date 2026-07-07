import { NextApiRequest } from "next";

type Counter = {
  count: number;
  resetAt: number;
};

type LockState = {
  failedCount: number;
  lockUntil: number;
};

const requestCounters = new Map<string, Counter>();
const credentialLockouts = new Map<string, LockState>();

const now = () => Date.now();

function pruneExpiredMaps() {
  const current = now();
  for (const [key, value] of requestCounters.entries()) {
    if (current >= value.resetAt) {
      requestCounters.delete(key);
    }
  }

  for (const [key, value] of credentialLockouts.entries()) {
    if (value.lockUntil > 0 && current >= value.lockUntil && value.failedCount === 0) {
      credentialLockouts.delete(key);
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toIpValue(raw: string | string[] | undefined): string {
  if (!raw) return "unknown";
  if (Array.isArray(raw)) return raw[0] || "unknown";
  return raw.split(",")[0]?.trim() || "unknown";
}

export function getRequestIp(req: NextApiRequest): string {
  return toIpValue(req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "unknown";
}

export function getRequestIpFromHeaders(headers?: Record<string, unknown>): string {
  if (!headers) return "unknown";
  const xForwardedFor = headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" || Array.isArray(xForwardedFor)) {
    return toIpValue(xForwardedFor);
  }
  return "unknown";
}

export function enforceIpRateLimit(
  keyPrefix: string,
  ip: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  pruneExpiredMaps();
  const key = `${keyPrefix}:${ip}`;
  const current = now();
  const state = requestCounters.get(key);

  if (!state || current >= state.resetAt) {
    requestCounters.set(key, { count: 1, resetAt: current + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (state.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - current) / 1000)),
    };
  }

  state.count += 1;
  requestCounters.set(key, state);
  return { allowed: true, retryAfterSeconds: 0 };
}

function lockoutKey(email: string, portal: string): string {
  return `${portal}:${normalizeEmail(email)}`;
}

export function isCredentialLocked(
  email: string,
  portal: string
): { locked: boolean; retryAfterSeconds: number } {
  pruneExpiredMaps();
  const key = lockoutKey(email, portal);
  const state = credentialLockouts.get(key);
  if (!state || state.lockUntil <= 0) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  const current = now();
  if (current >= state.lockUntil) {
    credentialLockouts.set(key, { failedCount: 0, lockUntil: 0 });
    return { locked: false, retryAfterSeconds: 0 };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - current) / 1000)),
  };
}

export function recordCredentialFailure(
  email: string,
  portal: string,
  maxFailures: number,
  lockMs: number
): { justLocked: boolean; retryAfterSeconds: number } {
  const key = lockoutKey(email, portal);
  const state = credentialLockouts.get(key) || { failedCount: 0, lockUntil: 0 };
  const current = now();

  if (state.lockUntil > current) {
    return {
      justLocked: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - current) / 1000)),
    };
  }

  const nextFailedCount = state.failedCount + 1;
  if (nextFailedCount >= maxFailures) {
    const lockUntil = current + lockMs;
    credentialLockouts.set(key, { failedCount: 0, lockUntil });
    return {
      justLocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(lockMs / 1000)),
    };
  }

  credentialLockouts.set(key, { failedCount: nextFailedCount, lockUntil: 0 });
  return { justLocked: false, retryAfterSeconds: 0 };
}

export function clearCredentialFailures(email: string, portal: string) {
  credentialLockouts.set(lockoutKey(email, portal), { failedCount: 0, lockUntil: 0 });
}
