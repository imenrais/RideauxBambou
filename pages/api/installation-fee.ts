import { NextApiRequest, NextApiResponse } from "next";
import { getInstallationFeeData } from "../../lib/installation-fee-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const feeData = await getInstallationFeeData();
      return res.status(200).json({
        success: true,
        data: feeData,
      });
    } catch (error) {
      console.error("Error fetching installation fee:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch installation fee",
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
