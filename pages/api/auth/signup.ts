import { NextApiRequest, NextApiResponse } from "next";
import { enforceIpRateLimit, getRequestIp } from "../../../lib/auth-throttle";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée",
    });
  }

  const ip = getRequestIp(req);
  const rateLimitCheck = await enforceIpRateLimit("api-auth-signup", ip, 6, 15 * 60 * 1000);
  if (!rateLimitCheck.allowed) {
    res.setHeader("Retry-After", String(rateLimitCheck.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  }

  return res.status(403).json({
    success: false,
    error:
      "La création de comptes clients est désactivée. Seul l'administrateur peut créer des comptes travailleurs.",
  });
}
