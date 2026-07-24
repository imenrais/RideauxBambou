import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { enforceIpRateLimit, getRequestIp } from "../../../lib/auth-throttle";
import { requiredEmailSchema } from "../../../lib/email-validation";
import { getEmailFromAddress } from "../../../lib/email-sender";
import { renderPasswordResetEmail } from "../../../lib/email-templates";
import { prisma } from "../../../lib/prisma";

// Validation schema
const forgotPasswordSchema = z.object({
  email: requiredEmailSchema,
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
    const rateLimitCheck = await enforceIpRateLimit("api-auth-forgot-password", ip, 8, 15 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      res.setHeader("Retry-After", String(rateLimitCheck.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: "Too many reset requests. Please try again later.",
      });
    }

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.issues[0].message,
      });
    }

    const { email } = validationResult.data;

    const genericMessage =
      "If an account exists with this email, a password reset link has been sent.";

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    // Always do comparable work so response timing does not leak whether the email exists.
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    if (!user) {
      // Burn roughly the same CPU as a real reset, then return the same message.
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 200)));
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    // Save reset token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: resetTokenExpiry,
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reinitialiser-mot-de-passe?token=${resetToken}`;

    const isDevelopment = process.env.NODE_ENV !== "production";

    // Send email
    try {
      const emailUser = process.env.EMAIL_SERVER_USER?.trim();
      const emailPassword = process.env.EMAIL_SERVER_PASSWORD?.replace(/\s+/g, "");
      const emailPort = parseInt((process.env.EMAIL_SERVER_PORT || "587").trim(), 10);

      // Check if email is configured
      if (!emailUser || !emailPassword) {
        if (isDevelopment) {
          console.warn("Email not configured. Reset link:", resetUrl);
          console.log("=".repeat(80));
          console.log("PASSWORD RESET LINK FOR:", user.email);
          console.log("Copy this link to reset password:", resetUrl);
          console.log("=".repeat(80));
        }

        return res.status(200).json({
          success: true,
          message: isDevelopment
            ? "Password reset email sent successfully"
            : "If an account exists with this email, a password reset link has been sent.",
          ...(isDevelopment ? { resetUrl, developmentMode: true } : {}),
        });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
        port: emailPort,
        secure: emailPort === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      const mailOptions = {
        from: getEmailFromAddress(),
        to: user.email,
        subject: "Réinitialisation de votre mot de passe - Rideaux Bambou",
        html: renderPasswordResetEmail(resetUrl),
        text: `
Réinitialisation de mot de passe - Rideaux Bambou

Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur le lien suivant pour créer un nouveau mot de passe :
${resetUrl}

Ce lien est valable pendant 1 heure.

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.

Cordialement,
L'équipe Rideaux Bambou
        `.trim(),
      };

      const emailResult = await transporter.sendMail(mailOptions);
      console.log("Password reset email accepted:", emailResult.messageId);

      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
        ...(isDevelopment ? { resetUrl } : {}),
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);

      // Still return success to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred. Please try again.",
    });
  }
}
