import { Prisma } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireAdmin } from "../../../lib/auth-helpers";
import { adminCustomerInfoSchema, serializeCustomerInfo } from "../../../lib/customer-info";
import { subscribePromoEmail } from "../../../lib/promo-subscriber-store";
import { matchesOrderSearch, normalizeOrderSearchText } from "../../../lib/order-search";
import { prisma } from "../../../lib/prisma";

const LEGACY_STATUS_MAP: Record<string, string> = {
  shipped: "processing",
};

const normalizeOrderStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return LEGACY_STATUS_MAP[normalized] || normalized;
};

const buildStatusWhere = (status?: string | string[]): Prisma.OrderWhereInput => {
  if (!status || Array.isArray(status)) {
    return {};
  }

  const normalizedStatus = normalizeOrderStatus(status);
  if (!normalizedStatus) {
    return {};
  }

  if (normalizedStatus === "processing") {
    return { OR: [{ status: "processing" }, { status: "shipped" }] };
  }

  return { status: normalizedStatus };
};

const adminOrderItemSchema = z.object({
  curtainTypeId: z.string().min(1).max(64).optional(),
  curtainTypeName: z.string().min(1, "Le nom du produit est requis").max(200),
  curtainType: z.enum(["panneau", "store"]).optional(),
  width: z.number().positive("La largeur doit être supérieure à 0"),
  height: z.number().positive("La hauteur doit être supérieure à 0"),
  totalCost: z.number().min(0, "Le prix produit doit être positif"),
  quantity: z.number().int().min(1, "La quantité doit être au moins 1").max(20).default(1),
});

const createAdminOrderSchema = z.object({
  customerInfo: adminCustomerInfoSchema,
  items: z
    .array(adminOrderItemSchema)
    .min(1, "Au moins un produit est requis")
    .max(20, "Trop de produits dans une commande"),
  wantsInstallation: z.boolean(),
  deliveryFee: z.number().min(0, "Les frais de livraison doivent être positifs"),
  installationFee: z.number().min(0, "Les frais de pose doivent être positifs"),
  notes: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, adminUser) => {
      try {
        const validationResult = createAdminOrderSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: validationResult.error.issues[0].message,
          });
        }

        const { customerInfo, items, wantsInstallation, deliveryFee, installationFee, notes } =
          validationResult.data;
        const resolvedInstallationFee = wantsInstallation ? installationFee : 0;
        const itemsTotal = items.reduce((sum, item) => sum + item.totalCost, 0);
        const totalAmount = Math.max(0, itemsTotal + deliveryFee + resolvedInstallationFee);
        const serializedCustomerInfo = serializeCustomerInfo(customerInfo);
        const persistedItems = items.map((item) => ({
          curtainTypeId: item.curtainTypeId || "manual-admin",
          curtainTypeName: item.curtainTypeName,
          ...(item.curtainType ? { curtainType: item.curtainType } : {}),
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          totalCost: item.totalCost,
        }));

        const createdOrder = await prisma.order.create({
          data: {
            userId: adminUser.id,
            items: persistedItems as unknown as Prisma.InputJsonValue,
            customerInfo: serializedCustomerInfo as unknown as Prisma.InputJsonValue,
            wantsInstallation,
            deliveryFee,
            installationFee: resolvedInstallationFee,
            totalAmount,
            // Enforce admin-created orders to always start as confirmed.
            status: "confirmed",
            notes: notes?.trim() || "",
          },
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        });

        if (customerInfo.email) {
          try {
            await subscribePromoEmail(customerInfo.email, "order");
          } catch (subscribeError) {
            console.error("Promo subscription error:", subscribeError);
          }
        }

        return res.status(201).json({
          success: true,
          data: {
            ...createdOrder,
            _id: createdOrder.id,
          },
        });
      } catch (error) {
        console.error("Admin order creation error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to create order",
        });
      }
    })(req, res);
  }

  if (req.method === "GET") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const { page = "1", limit = "10", status, search = "", orderId = "", includeStats = "false" } =
          req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;
        const normalizedSearch = normalizeOrderSearchText(search);
        const normalizedOrderIdLookup = normalizeOrderSearchText(orderId).replace(/\s/g, "");
        const shouldIncludeStats = includeStats === "true";

        const where = buildStatusWhere(status);
        const orderInclude = {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        } as const;

        let totalOrders = 0;
        let orders: Awaited<ReturnType<typeof prisma.order.findMany>> = [];

        if (normalizedOrderIdLookup) {
          const matchedOrders = await prisma.order.findMany({
            where: {
              AND: [
                where,
                {
                  OR: [
                    { id: normalizedOrderIdLookup },
                    { id: { endsWith: normalizedOrderIdLookup } },
                  ],
                },
              ],
            },
            include: orderInclude,
            orderBy: { createdAt: "desc" },
          });

          totalOrders = matchedOrders.length;
          orders = matchedOrders.slice(skip, skip + limitNum);
        } else if (normalizedSearch) {
            const allFilteredByStatus = await prisma.order.findMany({
              where,
              include: orderInclude,
              orderBy: { createdAt: "desc" },
            });

            const searchedOrders = allFilteredByStatus.filter((order) =>
              matchesOrderSearch(order, normalizedSearch)
            );

          totalOrders = searchedOrders.length;
          orders = searchedOrders.slice(skip, skip + limitNum);
        } else {
          totalOrders = await prisma.order.count({ where });
          orders = await prisma.order.findMany({
            where,
            include: orderInclude,
            orderBy: { createdAt: "desc" },
            skip,
            take: limitNum,
          });
        }

        let stats:
          | {
              totalOrders: number;
              pendingOrders: number;
              confirmedOrders: number;
              processingOrders: number;
              deliveredOrders: number;
              cancelledOrders: number;
            }
          | undefined;

        if (shouldIncludeStats) {
          const [
            totalOrdersCount,
            pendingOrdersCount,
            confirmedOrdersCount,
            processingOrdersCount,
            deliveredOrdersCount,
            cancelledOrdersCount,
          ] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { status: "pending" } }),
            prisma.order.count({ where: { status: "confirmed" } }),
            prisma.order.count({
              where: { OR: [{ status: "processing" }, { status: "shipped" }] },
            }),
            prisma.order.count({ where: { status: "delivered" } }),
            prisma.order.count({ where: { status: "cancelled" } }),
          ]);

          stats = {
            totalOrders: totalOrdersCount,
            pendingOrders: pendingOrdersCount,
            confirmedOrders: confirmedOrdersCount,
            processingOrders: processingOrdersCount,
            deliveredOrders: deliveredOrdersCount,
            cancelledOrders: cancelledOrdersCount,
          };
        }

        return res.status(200).json({
          success: true,
          data: {
            orders: orders.map((o) => ({
              ...o,
              status: normalizeOrderStatus(o.status),
              _id: o.id,
              userId: (o as any).user
                ? { name: (o as any).user.name, email: (o as any).user.email }
                : null,
            })),
            pagination: {
              currentPage: pageNum,
              totalPages: Math.ceil(totalOrders / limitNum),
              totalOrders,
              hasNext: pageNum < Math.ceil(totalOrders / limitNum),
              hasPrev: pageNum > 1,
            },
            ...(stats ? { stats } : {}),
          },
        });
      } catch (error) {
        console.error("Admin orders fetch error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch orders",
        });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const { id } = req.query;

        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "Order ID is required",
          });
        }

        const existingOrder = await prisma.order.findUnique({ where: { id } });

        if (!existingOrder) {
          return res.status(404).json({
            success: false,
            error: "Order not found",
          });
        }

        const hasItemsUpdate = Array.isArray(req.body?.items);
        const hasStatusUpdate = typeof req.body?.status === "string";

        if (!hasItemsUpdate && !hasStatusUpdate) {
          return res.status(400).json({
            success: false,
            error: "Status or items update is required",
          });
        }

        const data: Prisma.OrderUpdateInput = {};

        if (hasItemsUpdate) {
          const itemsResult = z
            .array(adminOrderItemSchema)
            .min(1, "Au moins un produit est requis")
            .max(20, "Trop de produits dans une commande")
            .safeParse(req.body.items);

          if (!itemsResult.success) {
            return res.status(400).json({
              success: false,
              error: itemsResult.error.issues[0].message,
            });
          }

          const items = itemsResult.data;
          const persistedItems = items.map((item) => ({
            curtainTypeId: item.curtainTypeId || "manual-admin",
            curtainTypeName: item.curtainTypeName,
            ...(item.curtainType ? { curtainType: item.curtainType } : {}),
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            totalCost: item.totalCost,
          }));
          const itemsTotal = items.reduce((sum, item) => sum + item.totalCost, 0);
          const deliveryFee = Number(existingOrder.deliveryFee) || 0;
          const installationFee = existingOrder.wantsInstallation
            ? Number(existingOrder.installationFee) || 0
            : 0;

          data.items = persistedItems as unknown as Prisma.InputJsonValue;
          data.totalAmount = Math.max(0, itemsTotal + deliveryFee + installationFee);
        }

        if (hasStatusUpdate) {
          const validStatuses = [
            "pending",
            "confirmed",
            "processing",
            "delivered",
            "cancelled",
          ];
          if (!validStatuses.includes(req.body.status)) {
            return res.status(400).json({
              success: false,
              error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
          }
          data.status = req.body.status;
        }

        const updatedOrder = await prisma.order.update({
          where: { id },
          data,
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        });

        return res.status(200).json({
          success: true,
          data: {
            ...updatedOrder,
            _id: updatedOrder.id,
            userId: updatedOrder.user
              ? { name: updatedOrder.user.name, email: updatedOrder.user.email }
              : null,
          },
        });
      } catch (error) {
        console.error("Admin order update error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update order",
        });
      }
    })(req, res);
  }

  if (req.method === "DELETE") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const { id } = req.query;

        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "Order ID is required",
          });
        }

        const existingOrder = await prisma.order.findUnique({ where: { id } });
        if (!existingOrder) {
          return res.status(404).json({
            success: false,
            error: "Order not found",
          });
        }

        await prisma.order.delete({ where: { id } });

        return res.status(200).json({
          success: true,
          data: { _id: id, id },
        });
      } catch (error) {
        console.error("Admin order delete error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to delete order",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
