import { NextApiRequest, NextApiResponse } from "next";

import { requireAdmin } from "../../../lib/auth-helpers";
import {
  deletePanneauWidth,
  getPanneauConfig,
  replacePanneauConfig,
  setPanneauSaleActive,
  updatePanneauFixedHeight,
  updatePanneauPromo,
  upsertPanneauWidth,
  type PanneauWidthInput,
} from "../../../lib/panneau-config-store";
import { notifyPromoSubscribersOfCurrentSales } from "../../../lib/sale-notifications";

const triggerPanneauSaleNotificationsIfNeeded = async (
  wasSaleActive: boolean,
  isSaleActive: boolean
) => {
  if (isSaleActive && !wasSaleActive) {
    try {
      const notificationResult = await notifyPromoSubscribersOfCurrentSales();
      console.log("Panneau sale notifications:", notificationResult);
    } catch (notificationError) {
      console.error("Panneau sale notification error:", notificationError);
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (_req: NextApiRequest, res: NextApiResponse) => {
      try {
        const config = await getPanneauConfig();
        return res.status(200).json({
          success: true,
          data: config,
        });
      } catch (error) {
        console.error("Error fetching panneau config:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch panneau configuration",
        });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const {
          fixedHeightCm,
          widths,
          isSaleActive,
          promoWidths,
          width,
          deleteWidthCm,
        } = req.body as {
          fixedHeightCm?: number;
          widths?: PanneauWidthInput[];
          isSaleActive?: boolean;
          promoWidths?: Array<{ widthCm: number; salePrice: number | null }>;
          width?: { widthCm: number; price: number; previousWidthCm?: number };
          deleteWidthCm?: number;
        };

        if (typeof deleteWidthCm === "number") {
          const config = await deletePanneauWidth(deleteWidthCm, user.email || "admin");
          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        if (width && typeof width.widthCm === "number" && typeof width.price === "number") {
          const config = await upsertPanneauWidth(width, user.email || "admin");
          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        if (
          typeof fixedHeightCm === "number" &&
          widths === undefined &&
          promoWidths === undefined &&
          isSaleActive === undefined
        ) {
          const config = await updatePanneauFixedHeight(fixedHeightCm, user.email || "admin");
          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        if (
          fixedHeightCm !== undefined &&
          Array.isArray(widths) &&
          typeof isSaleActive === "boolean"
        ) {
          const previousConfig = await getPanneauConfig();
          const config = await replacePanneauConfig(
            fixedHeightCm,
            widths,
            user.email || "admin",
            isSaleActive
          );
          void triggerPanneauSaleNotificationsIfNeeded(
            previousConfig.isSaleActive === true,
            isSaleActive
          );

          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        if (Array.isArray(promoWidths) && typeof isSaleActive === "boolean") {
          const previousConfig = await getPanneauConfig();
          const config = await updatePanneauPromo(
            promoWidths,
            isSaleActive,
            user.email || "admin"
          );
          void triggerPanneauSaleNotificationsIfNeeded(
            previousConfig.isSaleActive === true,
            isSaleActive
          );

          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        if (typeof isSaleActive === "boolean") {
          const previousConfig = await getPanneauConfig();
          const config = await setPanneauSaleActive(isSaleActive, user.email || "admin");
          void triggerPanneauSaleNotificationsIfNeeded(
            previousConfig.isSaleActive === true,
            isSaleActive
          );

          return res.status(200).json({
            success: true,
            data: config,
          });
        }

        return res.status(400).json({
          success: false,
          error: "Requête panneau invalide.",
        });
      } catch (error) {
        console.error("Error updating panneau config:", error);
        return res.status(400).json({
          success: false,
          error: "Failed to update panneau configuration",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
