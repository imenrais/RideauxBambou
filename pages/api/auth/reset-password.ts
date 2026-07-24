import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { enforceIpRateLimit, getRequestIp } from "../../../lib/auth-throttle";
import { strongPasswordSchema } from "../../../lib/password-validation";
import { prisma } from "../../../lib/prisma";

// Validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: strongPasswordSchema,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const ip = getRequestIp(req);
    const rateLimitCheck = await enforceIpRateLimit("api-auth-reset-password", ip, 12, 15 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      res.setHeader("Retry-After", String(rateLimitCheck.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: "Too many reset attempts. Please try again later.",
      });
    }

    // Validate input
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.issues[0].message,
      });
    }

    const { token, password } = validationResult.data;

    // Hash the token to find the user
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Le lien de réinitialisation est invalide ou a expiré.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      error: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}
