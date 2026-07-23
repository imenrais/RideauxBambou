import { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";

import {
  userLoginSchema,
  validateRequestBody,
  validateAndSanitizeEmail,
  setSecurityHeaders,
  handleApiError,
} from "../../../lib/security";
import { enforceIpRateLimit, getRequestIp } from "../../../lib/auth-throttle";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
    });
  }

  try {
    const ip = getRequestIp(req);
    const rateLimitCheck = enforceIpRateLimit("api-auth-login", ip, 20, 10 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      res.setHeader("Retry-After", String(rateLimitCheck.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: "Too many login attempts. Please try again later.",
      });
    }

    // Validate request body
    const validation = validateRequestBody(req, userLoginSchema);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || "Invalid request body",
      });
    }

    const { email, password } = req.body;

    // Validate and sanitize email
    const emailValidation = validateAndSanitizeEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: emailValidation.error,
        code: "INVALID_EMAIL",
      });
    }

    const sanitizedEmail = emailValidation.email;

    // Find user by email and include password
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail.toLowerCase() },
    });
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Create simple token (using NextAuth for actual authentication)
    const token = Buffer.from(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })
    ).toString("base64");

    // Return user data and token
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token,
    });
  } catch (error) {
    handleApiError(error, res);
  }
}
