import expressRateLimit from "express-rate-limit";
import helmet from "helmet";
import { NextApiRequest, NextApiResponse } from "next";
import validator from "validator";
import { requiredEmailSchema } from "./email-validation";

// Rate limiting configuration
const createRateLimit = (windowMs: number, max: number) => {
  return expressRateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: "Too many requests, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// API rate limits
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const authRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 requests per 15 minutes
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, 10); // 10 requests per hour

// Security middleware
export const securityMiddleware = (req: NextApiRequest, res: NextApiResponse, next: any) => {
  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Remove X-Powered-By header
  res.removeHeader("X-Powered-By");

  next();
};

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return validator.escape(input.trim());
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

// Email validation
export const isValidEmail = (email: string): boolean => {
  return requiredEmailSchema.safeParse(email).success;
};

// Phone validation
export const isValidPhone = (phone: string): boolean => {
  return validator.isMobilePhone(phone, "any") && phone.length <= 20;
};

// URL validation
export const isValidUrl = (url: string): boolean => {
  return validator.isURL(url, {
    protocols: ["http", "https"],
    require_protocol: true,
  });
};

// SQL injection prevention
export const sanitizeForDatabase = (input: string): string => {
  return validator
    .escape(input)
    .replace(/['"]/g, "")
    .replace(/[;]/g, "")
    .replace(/[--]/g, "")
    .replace(/[/*]/g, "")
    .replace(/[xp_]/g, "");
};

// XSS prevention
export const sanitizeHtml = (input: string): string => {
  return validator
    .escape(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
};

// File upload validation
export const validateFileUpload = (file: any): { isValid: boolean; error?: string } => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return { isValid: false, error: "No file provided" };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { isValid: false, error: "Invalid file type" };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: "File too large" };
  }

  return { isValid: true };
};

// Password strength validation
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long" };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one lowercase letter" };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one number" };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one special character" };
  }

  return { isValid: true };
};

// CSRF token validation
export const validateCSRFToken = (req: NextApiRequest, token: string): boolean => {
  const sessionToken = req.headers["x-csrf-token"] as string;
  return sessionToken === token;
};

// IP whitelist validation
export const isIPWhitelisted = (ip: string, whitelist: string[]): boolean => {
  return whitelist.includes(ip) || whitelist.includes("*");
};

// Request logging for security monitoring
export const logSecurityEvent = (event: string, details: any, req: NextApiRequest) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userAgent: req.headers["user-agent"],
    url: req.url,
    method: req.method,
    details,
  };

  // In production, send to monitoring service
  console.log("[SECURITY]", JSON.stringify(logEntry));
};

// Security headers for API responses
export const setSecurityHeaders = (res: NextApiResponse) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.removeHeader("X-Powered-By");
};

// Additional exports for API routes
export const rateLimit = createRateLimit;
export const validateRequestBody = (req: NextApiRequest, schema: any) => {
  // Basic request body validation
  if (!req.body) {
    return { isValid: false, error: "Request body is required" };
  }
  return { isValid: true };
};

// User login schema validation
export const userLoginSchema = {
  email: (email: string) => isValidEmail(email),
  password: (password: string) => password.length >= 8,
};

// Email validation and sanitization
export const validateAndSanitizeEmail = (
  email: string
): { isValid: true; email: string } | { isValid: false; error: string } => {
  const parsedEmail = requiredEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { isValid: false, error: "Invalid email format" };
  }
  return { isValid: true, email: parsedEmail.data };
};

// API error handling
export const handleApiError = (error: any, res: NextApiResponse) => {
  console.error("API Error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};

export default {
  securityMiddleware,
  sanitizeInput,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  sanitizeForDatabase,
  sanitizeHtml,
  validateFileUpload,
  validatePassword,
  validateCSRFToken,
  isIPWhitelisted,
  logSecurityEvent,
  setSecurityHeaders,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
};
