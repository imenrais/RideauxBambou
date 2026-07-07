/**
 * Admin middleware for protecting /admin/* API routes
 */

import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";

import { setSecurityHeaders, handleApiError } from "./security";

/**
 * Admin middleware that checks if user is authenticated and has admin role
 */
export function withAdminAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Set security headers
      setSecurityHeaders(res);

      // Check if user is authenticated
      const session = await getSession({ req });

      if (!session || !session.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has admin role
      if (session.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
          code: "ADMIN_REQUIRED",
          timestamp: new Date().toISOString(),
        });
      }

      // Log admin access for audit trail
      console.log(
        `Admin access: ${session.user.email} (${session.user.id}) - ${req.method} ${req.url} - ${new Date().toISOString()}`
      );

      // Call the protected handler
      await handler(req, res);
    } catch (error) {
      console.error("Admin middleware error:", error);
      handleApiError(error, res);
    }
  };
}

/**
 * Admin middleware with additional rate limiting
 */
export function withAdminAuthAndRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  maxRequests: number = 50,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return withAdminAuth(async (req: NextApiRequest, res: NextApiResponse) => {
    // Basic rate limiting for admin routes
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress || "unknown";
    const key = `admin-${ip}`;
    const now = Date.now();

    // Simple in-memory rate limiting (in production, use Redis or similar)
    const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
    const current = rateLimitMap.get(key);

    if (!current || now > current.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    } else if (current.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many admin requests",
        code: "ADMIN_RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
        timestamp: new Date().toISOString(),
      });
    } else {
      current.count++;
    }

    await handler(req, res);
  });
}

/**
 * Admin middleware with request logging
 */
export function withAdminAuthAndLogging(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return withAdminAuth(async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();

    // Log request details
    console.log(`Admin API Request: ${req.method} ${req.url}`, {
      user: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      body: req.method !== "GET" ? req.body : undefined,
    });

    // Call the handler
    await handler(req, res);

    // Log response details
    const duration = Date.now() - startTime;
    console.log(`Admin API Response: ${req.method} ${req.url}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Admin middleware with CSRF protection
 */
export function withAdminAuthAndCSRF(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return withAdminAuth(async (req: NextApiRequest, res: NextApiResponse) => {
    // Check for CSRF token on state-changing requests
    if (req.method && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const csrfToken = req.headers["x-csrf-token"] || req.body?.csrfToken;
      const session = await getSession({ req });

      // In a real implementation, you would validate the CSRF token
      // For now, we'll just check if it exists
      if (!csrfToken) {
        return res.status(403).json({
          success: false,
          error: "CSRF token required",
          code: "CSRF_TOKEN_REQUIRED",
          timestamp: new Date().toISOString(),
        });
      }
    }

    await handler(req, res);
  });
}

/**
 * Admin middleware with input sanitization
 */
export function withAdminAuthAndSanitization(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return withAdminAuth(async (req: NextApiRequest, res: NextApiResponse) => {
    // Sanitize request body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeRequestBody(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeQueryParams(req.query);
    }

    await handler(req, res);
  });
}

/**
 * Sanitize request body
 */
function sanitizeRequestBody(body: any): any {
  if (typeof body === "string") {
    return body.trim();
  }

  if (Array.isArray(body)) {
    return body.map(sanitizeRequestBody);
  }

  if (body && typeof body === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(body)) {
      sanitized[key] = sanitizeRequestBody(value);
    }
    return sanitized;
  }

  return body;
}

/**
 * Sanitize query parameters
 */
function sanitizeQueryParams(query: any): any {
  if (typeof query === "string") {
    return query.trim();
  }

  if (Array.isArray(query)) {
    return query.map(sanitizeQueryParams);
  }

  if (query && typeof query === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(query)) {
      sanitized[key] = sanitizeQueryParams(value);
    }
    return sanitized;
  }

  return query;
}
