import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "./auth-config";
import { logAuditEvent } from "./security-audit";
import { setSecurityHeaders } from "./security";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "worker" | "admin";
}

type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitState>();

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) {
    return forwarded[0] || "unknown";
  }
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

function getRequestPath(req: NextApiRequest): string {
  return req.url || "";
}

function applyRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  keyPrefix: string,
  limit: number,
  windowMs: number
): boolean {
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now >= current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
    res.status(429).json({
      success: false,
      error: "Too many requests, please try again later.",
    });
    return false;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return true;
}

function getTrustedOrigins(): string[] {
  const rawOrigins = [process.env.NEXTAUTH_URL, process.env.APP_URL].filter(Boolean) as string[];
  return rawOrigins
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));
}

function hasTrustedOrigin(req: NextApiRequest): boolean {
  const trustedOrigins = getTrustedOrigins();
  if (trustedOrigins.length === 0) {
    // Keep development ergonomics if origin is not configured.
    return process.env.NODE_ENV !== "production";
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  if (typeof originHeader === "string" && trustedOrigins.includes(originHeader)) {
    return true;
  }

  if (typeof refererHeader === "string") {
    try {
      const refererOrigin = new URL(refererHeader).origin;
      return trustedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }

  return false;
}

function requiresOriginCheck(req: NextApiRequest): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "");
}

/**
 * Get the current user session from the request
 */
export async function getCurrentUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser | null> {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email!,
      firstName: session.user.firstName!,
      lastName: session.user.lastName!,
      role: session.user.role as "user" | "worker" | "admin",
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const user = await getCurrentUser(req, res);
  return user?.role === "admin" || false;
}

/**
 * Middleware to protect API routes that require authentication
 */
export function requireAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setSecurityHeaders(res);
    res.setHeader("Cache-Control", "no-store");

    if (!applyRateLimit(req, res, "auth", 150, 15 * 60 * 1000)) {
      return;
    }

    if (requiresOriginCheck(req) && !hasTrustedOrigin(req)) {
      logAuditEvent({
        event: "AUTH_ORIGIN_REJECTED",
        level: "warning",
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
      return res.status(403).json({ error: "Invalid request origin" });
    }

    const user = await getCurrentUser(req, res);

    if (!user) {
      logAuditEvent({
        event: "AUTH_REQUIRED_REJECTED",
        level: "warning",
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
      return res.status(401).json({ error: "Authentication required" });
    }

    return handler(req, res, user);
  };
}

/**
 * Middleware to protect API routes that require admin access
 */
export function requireAdmin(
  handler: (req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setSecurityHeaders(res);
    res.setHeader("Cache-Control", "no-store");

    if (!applyRateLimit(req, res, "admin", 100, 15 * 60 * 1000)) {
      return;
    }

    if (requiresOriginCheck(req) && !hasTrustedOrigin(req)) {
      logAuditEvent({
        event: "ADMIN_ORIGIN_REJECTED",
        level: "warning",
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
      return res.status(403).json({ error: "Invalid request origin" });
    }

    const user = await getCurrentUser(req, res);

    if (!user) {
      logAuditEvent({
        event: "ADMIN_AUTH_REQUIRED_REJECTED",
        level: "warning",
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
      return res.status(401).json({ error: "Authentication required" });
    }

    if (user.role !== "admin") {
      logAuditEvent({
        event: "ADMIN_FORBIDDEN_REJECTED",
        level: "warning",
        actorId: user.id,
        actorRole: user.role,
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
      return res.status(403).json({ error: "Admin access required" });
    }

    if (requiresOriginCheck(req)) {
      logAuditEvent({
        event: "ADMIN_MUTATION_REQUEST",
        actorId: user.id,
        actorRole: user.role,
        ip: getClientIp(req),
        path: getRequestPath(req),
        method: req.method || "",
      });
    }

    return handler(req, res, user);
  };
}

/**
 * Helper to check if a user has a specific role
 */
export function hasRole(
  user: AuthenticatedUser | null,
  role: "user" | "worker" | "admin"
): boolean {
  return user?.role === role || false;
}

/**
 * Helper to check if a user has admin or higher privileges
 */
export function isAdminOrHigher(user: AuthenticatedUser | null): boolean {
  return user?.role === "admin" || false;
}
