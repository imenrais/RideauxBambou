import { NextApiRequest, NextApiResponse } from "next";
import { getPriceData } from "../../lib/price-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
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
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
