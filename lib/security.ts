import { NextApiRequest, NextApiResponse } from "next";

import { requiredEmailSchema } from "./email-validation";

export const isValidEmail = (email: string): boolean => {
  return requiredEmailSchema.safeParse(email).success;
};

export const setSecurityHeaders = (res: NextApiResponse) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.removeHeader("X-Powered-By");
};

export const validateRequestBody = (req: NextApiRequest, _schema: unknown) => {
  if (!req.body) {
    return { isValid: false, error: "Request body is required" };
  }
  return { isValid: true };
};

export const userLoginSchema = {
  email: (email: string) => isValidEmail(email),
  password: (password: string) => password.length >= 8,
};

export const validateAndSanitizeEmail = (
  email: string
): { isValid: true; email: string } | { isValid: false; error: string } => {
  const parsedEmail = requiredEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { isValid: false, error: "Invalid email format" };
  }
  return { isValid: true, email: parsedEmail.data };
};

export const handleApiError = (error: unknown, res: NextApiResponse) => {
  console.error("API Error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};
