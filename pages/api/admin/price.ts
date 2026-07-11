import { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "../../../lib/auth-helpers";
import {
  getPriceData,
  setGlobalPrice,
  updatePanneauPrices,
  updateSaleSettings,
} from "../../../lib/price-store";
import { notifyPromoSubscribersOfCurrentSales } from "../../../lib/sale-notifications";

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
        const { pricePerM2, salePricePerM2, isSaleActive, panneauPrice100cm, panneauPrice130cm } =
          req.body ?? {};
        const hasListPriceUpdate = pricePerM2 !== undefined;
        const hasSaleUpdate = salePricePerM2 !== undefined || isSaleActive !== undefined;
        const hasPanneauUpdate =
          panneauPrice100cm !== undefined || panneauPrice130cm !== undefined;

        if (!hasListPriceUpdate && !hasSaleUpdate && !hasPanneauUpdate) {
          return res.status(400).json({
            success: false,
            error: "Aucune modification fournie",
          });
        }

        if (hasListPriceUpdate) {
          if (typeof pricePerM2 !== "number" || pricePerM2 <= 0) {
            return res.status(400).json({
              success: false,
              error: "Invalid price. Must be a positive number.",
            });
          }
          await setGlobalPrice(pricePerM2, user.email);
        }

        if (hasSaleUpdate) {
          const currentPrice = await getPriceData();
          const wasStoreSaleActive = currentPrice.isSaleActive === true;
          const nextSalePrice =
            salePricePerM2 === null || salePricePerM2 === ""
              ? null
              : typeof salePricePerM2 === "number"
                ? salePricePerM2
                : currentPrice.salePricePerM2;
          const nextSaleActive = typeof isSaleActive === "boolean" ? isSaleActive : currentPrice.isSaleActive;

          if (nextSaleActive) {
            if (typeof nextSalePrice !== "number" || nextSalePrice <= 0) {
              return res.status(400).json({
                success: false,
                error: "Le prix promotionnel doit être un nombre positif.",
              });
            }
            if (nextSalePrice >= currentPrice.pricePerM2) {
              return res.status(400).json({
                success: false,
                error: "Le prix promotionnel doit être inférieur au prix catalogue.",
              });
            }
          }

          await updateSaleSettings(nextSalePrice, nextSaleActive, user.email);

          const shouldNotifyStoreSale =
            nextSaleActive &&
            typeof nextSalePrice === "number" &&
            nextSalePrice > 0 &&
            nextSalePrice < currentPrice.pricePerM2 &&
            !wasStoreSaleActive;

          if (shouldNotifyStoreSale) {
            try {
              const notificationResult = await notifyPromoSubscribersOfCurrentSales();
              console.log("Store sale notifications:", notificationResult);
            } catch (notificationError) {
              console.error("Store sale notification error:", notificationError);
            }
          }
        }

        if (hasPanneauUpdate) {
          const currentPrice = await getPriceData();
          const nextPanneau100 =
            typeof panneauPrice100cm === "number"
              ? panneauPrice100cm
              : currentPrice.panneauPrice100cm;
          const nextPanneau130 =
            typeof panneauPrice130cm === "number"
              ? panneauPrice130cm
              : currentPrice.panneauPrice130cm;

          if (nextPanneau100 <= 0 || nextPanneau130 <= 0) {
            return res.status(400).json({
              success: false,
              error: "Les prix panneau doivent être des nombres positifs.",
            });
          }

          await updatePanneauPrices(nextPanneau100, nextPanneau130, user.email);
        }

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
