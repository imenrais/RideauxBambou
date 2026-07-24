import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { enforceIpRateLimit, getRequestIp } from "../../lib/auth-throttle";
import { requiredEmailSchema } from "../../lib/email-validation";
import { subscribePromoEmail } from "../../lib/promo-subscriber-store";
import { notifyPromoSubscriberIfSalesActive } from "../../lib/sale-notifications";

const newsletterSchema = z.object({
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
    const rateLimitCheck = await enforceIpRateLimit("api-newsletter", ip, 8, 15 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      res.setHeader("Retry-After", String(rateLimitCheck.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: "Trop de tentatives. Réessayez plus tard.",
      });
    }

    const validation = newsletterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.issues[0]?.message || "Email invalide.",
      });
    }

    const subscription = await subscribePromoEmail(validation.data.email, "newsletter");

    if (subscription.email) {
      try {
        await notifyPromoSubscriberIfSalesActive(subscription.email);
      } catch (notificationError) {
        console.error("Newsletter sale notification error:", notificationError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Inscription à la newsletter réussie.",
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return res.status(500).json({
      success: false,
      error: "Impossible de finaliser l'inscription.",
    });
  }
}
