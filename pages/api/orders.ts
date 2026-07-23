import { Prisma } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireAuth } from "../../lib/auth-helpers";
import { checkoutCustomerInfoSchema, getCustomerDisplayName, serializeCustomerInfo } from "../../lib/customer-info";
import { getAllDeliveryFees } from "../../lib/delivery-fee-store";
import { sendAdminOrderNotificationEmail, sendOrderConfirmationEmail } from "../../lib/email";
import { subscribePromoEmail } from "../../lib/promo-subscriber-store";
import { prisma } from "../../lib/prisma";

// Validation schema for cart checkout
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        curtainTypeId: z.string().min(1, "Curtain type ID is required"),
        curtainTypeName: z.string().min(1, "Curtain type name is required"),
        width: z
          .number()
          .min(1, "Width must be at least 1cm"),
        height: z
          .number()
          .min(100, "Height must be at least 100cm")
          .max(250, "Height must be at most 250cm"),
        totalCost: z.number().min(0, "Total cost must be positive"),
        quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
      })
    )
    .min(1, "At least one item is required"),
  customerInfo: checkoutCustomerInfoSchema,
  totalAmount: z.number().min(0, "Total amount must be positive"),
  deliveryFee: z.number().min(0, "Delivery fee must be positive"),
  installationFee: z.number().min(0, "Les frais de pose doivent être positifs"),
  wantsInstallation: z.boolean(),
});

const normalizeGovernorate = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const GOVERNORATE_CODE_MAP: Record<string, string> = {
  ariana: "AR",
  beja: "BJ",
  "ben arous": "BA",
  bizerte: "BI",
  gabes: "GB",
  gafsa: "GF",
  jendouba: "JE",
  kairouan: "KR",
  kasserine: "KS",
  kebili: "KB",
  kef: "KF",
  mahdia: "MH",
  manouba: "MN",
  medenine: "ME",
  monastir: "MO",
  nabeul: "NB",
  sfax: "SF",
  "sidi bouzid": "SB",
  siliana: "SL",
  sousse: "SO",
  tataouine: "TT",
  tozeur: "TO",
  tunis: "TU",
  zaghouan: "ZA",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      // Validate input
      const validationResult = createOrderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const { items, customerInfo, totalAmount, deliveryFee, installationFee, wantsInstallation } =
        validationResult.data;
      const customerEmail = customerInfo.email || "";

      const productIds = Array.from(new Set(items.map((item) => item.curtainTypeId)));
      const validProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          isAvailable: true,
        },
        select: { id: true },
      });
      const validProductIds = new Set(validProducts.map((product) => product.id));
      const unavailableItem = items.find((item) => !validProductIds.has(item.curtainTypeId));

      if (unavailableItem) {
        return res.status(400).json({
          success: false,
          error: "Un des produits sélectionnés est hors stock ou indisponible.",
        });
      }

      const deliveryFees = await getAllDeliveryFees();
      const normalizedState = normalizeGovernorate(customerInfo.state);
      const stateCode =
        GOVERNORATE_CODE_MAP[normalizedState] ||
        (customerInfo.state.trim().length === 2 ? customerInfo.state.trim().toUpperCase() : "");
      const matchedDeliveryFee = deliveryFees.find(
        (fee) =>
          normalizeGovernorate(fee.state) === normalizedState ||
          fee.stateCode === stateCode
      );
      const resolvedDeliveryFee = matchedDeliveryFee?.fee ?? 0;
      const resolvedInstallationFee = wantsInstallation ? installationFee : 0;
      const resolvedTotalAmount = Math.max(
        0,
        totalAmount - deliveryFee - installationFee + resolvedDeliveryFee + resolvedInstallationFee
      );

      // Create a single order with multiple items (guest checkout allowed)
      const orderPayload = {
        items: items as unknown as Prisma.InputJsonValue,
        deliveryFee: resolvedDeliveryFee,
        installationFee: resolvedInstallationFee,
        wantsInstallation,
        totalAmount: resolvedTotalAmount,
        customerInfo: serializeCustomerInfo(customerInfo) as unknown as Prisma.InputJsonValue,
        notes: customerInfo.notes || "",
        status: "pending",
      };
      const createdOrder = await prisma.order.create({
        data: orderPayload,
      });

      if (customerEmail) {
        try {
          await subscribePromoEmail(customerEmail, "order");
        } catch (subscribeError) {
          console.error("Promo subscription error:", subscribeError);
        }
      }

      let customerEmailSent = false;

      void (async () => {
        try {
          const adminUsers = await prisma.user.findMany({
            where: { role: "admin" },
            select: { email: true },
          });
          const adminRecipients = adminUsers
            .map((adminUser) => adminUser.email?.trim())
            .filter((email): email is string => Boolean(email));

          const itemCount = items.reduce(
            (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
            0
          );

          const orderData = {
            orderId: createdOrder.id,
            items: items.map((item) => ({
              name: item.curtainTypeName,
              quantity: Math.max(1, Number(item.quantity) || 1),
              price: item.totalCost,
              dimensions: `${item.width}cm x ${item.height}cm`,
            })),
            installationFee: resolvedInstallationFee,
            deliveryFee: resolvedDeliveryFee,
            wantsInstallation,
            totalAmount: resolvedTotalAmount,
            shippingAddress: {
              street: customerInfo.address,
              city: customerInfo.city,
              postalCode: customerInfo.postalCode,
              country: "Tunisie",
            },
            orderDate: new Date().toISOString(),
          };

          if (customerEmail) {
            const customerEmailResult = await sendOrderConfirmationEmail(
              customerEmail,
              getCustomerDisplayName(serializeCustomerInfo(customerInfo)),
              orderData
            );
            customerEmailSent = customerEmailResult.success;
          }

          await sendAdminOrderNotificationEmail({
            orderId: createdOrder.id,
            customerName: getCustomerDisplayName(serializeCustomerInfo(customerInfo)),
            customerEmail: customerInfo.email || "Non renseigné",
            customerPhone: customerInfo.phone,
            totalAmount: resolvedTotalAmount,
            itemCount,
            createdAt: new Date().toISOString(),
            recipients: adminRecipients,
          });
        } catch (emailError) {
          console.error("Order email notification error:", emailError);
        }
      })();

      const itemCount = items.reduce(
        (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
        0
      );

      return res.status(201).json({
        success: true,
        data: {
          orderId: createdOrder.id,
          totalAmount: resolvedTotalAmount,
          installationFee: resolvedInstallationFee,
          itemCount,
          status: "pending",
          deliveryFee: resolvedDeliveryFee,
          customerEmailSent,
        },
      });
    } catch (error) {
      console.error("Order creation error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create order",
      });
    }
  }

  if (req.method === "GET") {
    return requireAuth(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const orders = await prisma.order.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
          success: true,
          data: orders.map((o) => ({ ...o, _id: o.id })),
        });
      } catch (error) {
        console.error("Orders fetch error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch orders",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
