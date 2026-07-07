import { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "../../../lib/auth-helpers";
import {
  getInstallationFeeData,
  setGlobalInstallationFee,
} from "../../../lib/installation-fee-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (_req: NextApiRequest, res: NextApiResponse, _user) => {
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
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { fee } = req.body;

        if (typeof fee !== "number" || fee < 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid fee. Must be a positive number.",
          });
        }

        // Update global installation fee using database
        await setGlobalInstallationFee(fee, user.email);

        // Get updated fee data
        const updatedFeeData = await getInstallationFeeData();

        return res.status(200).json({
          success: true,
          data: {
            ...updatedFeeData,
            updatedBy: user.email,
          },
        });
      } catch (error) {
        console.error("Error updating installation fee:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update installation fee",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
