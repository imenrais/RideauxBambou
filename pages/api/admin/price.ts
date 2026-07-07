import { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "../../../lib/auth-helpers";
import { getPriceData, setGlobalPrice } from "../../../lib/price-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (_req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const priceData = await getPriceData();
        return res.status(200).json({
          success: true,
          data: priceData,
        });
      } catch (error) {
        console.error("Error fetching price:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch price",
        });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { pricePerM2 } = req.body;

        if (typeof pricePerM2 !== "number" || pricePerM2 <= 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid price. Must be a positive number.",
          });
        }

        // Update global price using database
        await setGlobalPrice(pricePerM2, user.email);

        // Get updated price data
        const updatedPriceData = await getPriceData();

        return res.status(200).json({
          success: true,
          data: {
            ...updatedPriceData,
            updatedBy: user.email,
          },
        });
      } catch (error) {
        console.error("Error updating price:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update price",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
