import { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "../../../lib/auth-helpers";
import {
  getAllDeliveryFees,
  updateDeliveryFee,
  refreshDeliveryFeesCache,
  makeAllDeliveryFeesFree,
  restoreDeliveryFeesFromBackup,
  getDeliveryFeeSettings,
} from "../../../lib/delivery-fee-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (_req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const [fees, settings] = await Promise.all([getAllDeliveryFees(), getDeliveryFeeSettings()]);
        return res.status(200).json({
          success: true,
          data: fees,
          meta: {
            isFreeDeliveryActive: settings.isFreeDeliveryActive,
            hasBackup: Array.isArray(settings.feeBackup) && settings.feeBackup.length > 0,
          },
        });
      } catch (error) {
        console.error("Error fetching delivery fees:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch delivery fees",
        });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { state, fee } = req.body;

        if (!state || typeof fee !== "number" || fee < 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid state or fee. State is required and fee must be a positive number.",
          });
        }

        const updatedFee = await updateDeliveryFee(state, fee, user.email);
        const settings = await getDeliveryFeeSettings();

        return res.status(200).json({
          success: true,
          data: updatedFee,
          meta: {
            isFreeDeliveryActive: settings.isFreeDeliveryActive,
          },
        });
      } catch (error) {
        console.error("Error updating delivery fee:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update delivery fee",
        });
      }
    })(req, res);
  }

  if (req.method === "POST") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { action } = req.body;

        if (action === "refresh") {
          const fees = await refreshDeliveryFeesCache();
          return res.status(200).json({
            success: true,
            data: fees,
            message: "Delivery fees cache refreshed",
          });
        }

        if (action === "make-all-free") {
          const result = await makeAllDeliveryFeesFree(user.email);
          return res.status(200).json({
            success: true,
            data: result.fees,
            meta: {
              isFreeDeliveryActive: result.settings.isFreeDeliveryActive,
              hasBackup: Array.isArray(result.settings.feeBackup) && result.settings.feeBackup.length > 0,
            },
            message: "All delivery fees set to free",
          });
        }

        if (action === "restore-from-backup") {
          const result = await restoreDeliveryFeesFromBackup(user.email);
          const hasBackup =
            Array.isArray(result.settings.feeBackup) && result.settings.feeBackup.length > 0;
          return res.status(200).json({
            success: true,
            data: result.fees,
            meta: {
              isFreeDeliveryActive: result.settings.isFreeDeliveryActive,
              hasBackup,
              restoredFromBackup: result.restoredFromBackup,
            },
            message: result.restoredFromBackup
              ? "Delivery fees restored from backup"
              : "Free delivery deactivated without backup restore",
          });
        }

        return res.status(400).json({
          success: false,
          error: "Invalid action",
        });
      } catch (error) {
        console.error("Error refreshing delivery fees:", error);
        const message =
          error instanceof Error ? error.message : "Failed to refresh delivery fees";
        return res.status(500).json({
          success: false,
          error: message,
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
