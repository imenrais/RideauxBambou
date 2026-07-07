import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { enforceIpRateLimit, getRequestIp } from "../../../lib/auth-throttle";
import { prisma } from "../../../lib/prisma";

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
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
    const rateLimitCheck = enforceIpRateLimit("api-auth-forgot-password", ip, 8, 15 * 60 * 1000);
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

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Only proceed if user exists
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Aucun compte trouvé avec cette adresse email.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: resetTokenExpiry,
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

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
        from: process.env.EMAIL_FROM || "noreply@rideaux-bambou.com",
        to: user.email,
        subject: "Réinitialisation de votre mot de passe - Rideaux Bambou",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #16a34a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { color: white; margin: 0; }
                .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
                .button:hover { background-color: #15803d; }
                .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Rideaux Bambou</h1>
                </div>
                <div class="content">
                  <h2>Réinitialisation de mot de passe</h2>
                  <p>Bonjour,</p>
                  <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                  <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                  </div>
                  <p>Ce lien est valable pendant 1 heure.</p>
                  <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
                  <p>Cordialement,<br>L'équipe Rideaux Bambou</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Rideaux Bambou. Tous droits réservés.</p>
                </div>
              </div>
            </body>
          </html>
        `,
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
        `,
      };

      console.log("📧 Sending password reset email to:", user.email);
      console.log("📧 Email from:", mailOptions.from);
      console.log("📧 Email to:", mailOptions.to);
      const emailResult = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", emailResult.messageId);
      console.log("📧 Accepted recipients:", emailResult.accepted);
      console.log("📧 Rejected recipients:", emailResult.rejected);

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
