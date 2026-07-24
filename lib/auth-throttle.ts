import { NextApiRequest } from "next";

import {
  clearSharedFailures,
  enforceSharedRateLimit,
  getSharedLockStatus,
  recordSharedFailure,
} from "./rate-limit-store";

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

export async function enforceIpRateLimit(
  keyPrefix: string,
  ip: string,
  limit: number,
  windowMs: number,
  options?: { failClosed?: boolean }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const result = await enforceSharedRateLimit(`${keyPrefix}:${ip}`, limit, windowMs, options);
  return {
    allowed: result.allowed,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

function lockoutKey(email: string, portal: string): string {
  return `${portal}:${normalizeEmail(email)}`;
}

export async function isCredentialLocked(
  email: string,
  portal: string
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  return getSharedLockStatus(lockoutKey(email, portal));
}

export async function recordCredentialFailure(
  email: string,
  portal: string,
  maxFailures: number,
  lockMs: number
): Promise<{ justLocked: boolean; retryAfterSeconds: number }> {
  return recordSharedFailure(lockoutKey(email, portal), maxFailures, lockMs);
}

export async function clearCredentialFailures(email: string, portal: string): Promise<void> {
  await clearSharedFailures(lockoutKey(email, portal));
}
