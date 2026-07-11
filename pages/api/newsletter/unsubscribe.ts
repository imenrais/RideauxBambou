import { NextApiRequest, NextApiResponse } from "next";

import { requiredEmailSchema } from "../../../lib/email-validation";
import { unsubscribePromoEmail } from "../../../lib/promo-subscriber-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const rawEmail = req.method === "GET" ? req.query.email : req.body?.email;
  const validation = requiredEmailSchema.safeParse(
    typeof rawEmail === "string" ? rawEmail : Array.isArray(rawEmail) ? rawEmail[0] : ""
  );

  if (!validation.success) {
    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(400).send(renderPage("Lien de désabonnement invalide.", false));
    }

    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || "Email invalide.",
    });
  }

  try {
    await unsubscribePromoEmail(validation.data);

    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(
        renderPage("Vous ne recevrez plus nos emails promotionnels.", true)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Désabonnement effectué.",
    });
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);

    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(renderPage("Impossible de finaliser le désabonnement.", false));
    }

    return res.status(500).json({
      success: false,
      error: "Impossible de finaliser le désabonnement.",
    });
  }
}

function renderPage(message: string, success: boolean) {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Désabonnement - Rideaux Bambou</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 48px auto; padding: 0 16px;">
    <h1 style="color: ${success ? "#16a34a" : "#dc2626"};">Rideaux Bambou</h1>
    <p>${message}</p>
    <p><a href="/">Retour à la boutique</a></p>
  </body>
</html>`;
}
