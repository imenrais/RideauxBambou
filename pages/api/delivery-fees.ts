import { NextApiRequest, NextApiResponse } from "next";
import { getAllDeliveryFees, getDeliveryFeeByState } from "../../lib/delivery-fee-store";
import { setPublicCacheHeaders } from "../../lib/api-cache";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const { state } = req.query;

      if (state) {
        // Get fee for specific state
        const fee = await getDeliveryFeeByState(state as string);
        if (!fee) {
          return res.status(404).json({
            success: false,
            error: "State not found",
          });
        }
        return res.status(200).json({
          success: true,
          data: fee,
        });
      } else {
        // Get all fees
        const fees = await getAllDeliveryFees();
        setPublicCacheHeaders(res, 300);
        return res.status(200).json({
          success: true,
          data: fees,
        });
      }
    } catch (error) {
      console.error("Error fetching delivery fees:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch delivery fees",
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
