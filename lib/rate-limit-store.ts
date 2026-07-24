import { prisma } from "./prisma";

type CounterResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
};

type LockStatus = {
  locked: boolean;
  retryAfterSeconds: number;
};

type FailureResult = {
  justLocked: boolean;
  retryAfterSeconds: number;
};

type MemoryCounter = {
  count: number;
  resetAt: number;
};

type MemoryLock = {
  failedCount: number;
  lockUntil: number;
};

/** Process-local fallback if Postgres is unavailable. */
const memoryCounters = new Map<string, MemoryCounter>();
const memoryLocks = new Map<string, MemoryLock>();

const now = () => Date.now();

function memoryEnforce(
  key: string,
  limit: number,
  windowMs: number
): CounterResult {
  const current = now();
  const state = memoryCounters.get(key);

  if (!state || current >= state.resetAt) {
    memoryCounters.set(key, { count: 1, resetAt: current + windowMs });
    return { allowed: true, retryAfterSeconds: 0, count: 1 };
  }

  if (state.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - current) / 1000)),
      count: state.count,
    };
  }

  state.count += 1;
  memoryCounters.set(key, state);
  return { allowed: true, retryAfterSeconds: 0, count: state.count };
}

/**
 * Shared rate limit across Node processes via Postgres (atomic upsert).
 * Falls back to in-memory if the DB is unreachable.
 */
export async function enforceSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options?: { failClosed?: boolean }
): Promise<CounterResult> {
  const resetAt = new Date(now() + windowMs);
  const failClosed = options?.failClosed === true;

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitEntry" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitEntry"."resetAt" <= NOW() THEN 1
          ELSE "RateLimitEntry"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitEntry"."resetAt" <= NOW() THEN ${resetAt}
          ELSE "RateLimitEntry"."resetAt"
        END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    if (!row) {
      if (failClosed) {
        return { allowed: false, retryAfterSeconds: 60, count: limit + 1 };
      }
      return memoryEnforce(key, limit, windowMs);
    }

    const count = Number(row.count);
    const rowResetAt = new Date(row.resetAt).getTime();

    if (count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((rowResetAt - now()) / 1000)),
        count,
      };
    }

    return { allowed: true, retryAfterSeconds: 0, count };
  } catch (error) {
    console.error("Shared rate limit store unavailable:", error);
    if (failClosed) {
      return { allowed: false, retryAfterSeconds: 60, count: limit + 1 };
    }
    console.error("Using memory fallback for rate limit.");
    return memoryEnforce(key, limit, windowMs);
  }
}

export async function getSharedLockStatus(key: string): Promise<LockStatus> {
  try {
    const row = await prisma.authLockout.findUnique({ where: { key } });
    if (!row?.lockUntil) {
      return { locked: false, retryAfterSeconds: 0 };
    }

    const lockUntil = row.lockUntil.getTime();
    if (now() >= lockUntil) {
      await prisma.authLockout.update({
        where: { key },
        data: { failedCount: 0, lockUntil: null },
      });
      return { locked: false, retryAfterSeconds: 0 };
    }

    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((lockUntil - now()) / 1000)),
    };
  } catch (error) {
    console.error("Shared lockout read failed, using memory fallback:", error);
    const state = memoryLocks.get(key);
    if (!state || state.lockUntil <= 0 || now() >= state.lockUntil) {
      return { locked: false, retryAfterSeconds: 0 };
    }
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - now()) / 1000)),
    };
  }
}

export async function recordSharedFailure(
  key: string,
  maxFailures: number,
  lockMs: number
): Promise<FailureResult> {
  try {
    const existing = await prisma.authLockout.findUnique({ where: { key } });
    const current = now();

    if (existing?.lockUntil && existing.lockUntil.getTime() > current) {
      return {
        justLocked: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.lockUntil.getTime() - current) / 1000)),
      };
    }

    const nextFailedCount = (existing?.failedCount || 0) + 1;
    if (nextFailedCount >= maxFailures) {
      const lockUntil = new Date(current + lockMs);
      await prisma.authLockout.upsert({
        where: { key },
        create: { key, failedCount: 0, lockUntil },
        update: { failedCount: 0, lockUntil },
      });
      return {
        justLocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil(lockMs / 1000)),
      };
    }

    await prisma.authLockout.upsert({
      where: { key },
      create: { key, failedCount: nextFailedCount, lockUntil: null },
      update: { failedCount: nextFailedCount, lockUntil: null },
    });
    return { justLocked: false, retryAfterSeconds: 0 };
  } catch (error) {
    console.error("Shared lockout write failed, using memory fallback:", error);
    const state = memoryLocks.get(key) || { failedCount: 0, lockUntil: 0 };
    const current = now();

    if (state.lockUntil > current) {
      return {
        justLocked: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - current) / 1000)),
      };
    }

    const nextFailedCount = state.failedCount + 1;
    if (nextFailedCount >= maxFailures) {
      memoryLocks.set(key, { failedCount: 0, lockUntil: current + lockMs });
      return {
        justLocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil(lockMs / 1000)),
      };
    }

    memoryLocks.set(key, { failedCount: nextFailedCount, lockUntil: 0 });
    return { justLocked: false, retryAfterSeconds: 0 };
  }
}

export async function clearSharedFailures(key: string): Promise<void> {
  try {
    await prisma.authLockout.upsert({
      where: { key },
      create: { key, failedCount: 0, lockUntil: null },
      update: { failedCount: 0, lockUntil: null },
    });
  } catch (error) {
    console.error("Shared lockout clear failed, using memory fallback:", error);
    memoryLocks.set(key, { failedCount: 0, lockUntil: 0 });
  }
}
