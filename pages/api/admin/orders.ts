import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth-helpers";
import { prisma } from "../../../lib/prisma";

const createAdminOrderSchema = z.object({
  customerInfo: z.object({
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
    phone: z.string().min(8, "Le téléphone est requis"),
    address: z.string().min(5, "L'adresse est requise"),
    city: z.string().min(2, "La ville est requise"),
    state: z.string().min(2, "La région est requise"),
    postalCode: z.string().min(2, "Le code postal est requis"),
  }),
  item: z.object({
    curtainTypeName: z.string().min(1, "Le nom du produit est requis"),
    width: z.number().positive("La largeur doit être supérieure à 0"),
    height: z.number().positive("La hauteur doit être supérieure à 0"),
    totalCost: z.number().min(0, "Le prix produit doit être positif"),
  }),
  wantsInstallation: z.boolean(),
  deliveryFee: z.number().min(0, "Les frais de livraison doivent être positifs"),
  installationFee: z.number().min(0, "Les frais de pose doivent être positifs"),
  status: z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]).optional(),
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

        const { customerInfo, item, wantsInstallation, deliveryFee, installationFee, status, notes } =
          validationResult.data;
        const resolvedInstallationFee = wantsInstallation ? installationFee : 0;
        const totalAmount = Math.max(0, item.totalCost + deliveryFee + resolvedInstallationFee);

        const createdOrder = await prisma.order.create({
          data: {
            userId: adminUser.id,
            items: [
              {
                curtainTypeId: "manual-admin",
                curtainTypeName: item.curtainTypeName,
                width: item.width,
                height: item.height,
                totalCost: item.totalCost,
              },
            ] as unknown as Prisma.InputJsonValue,
            customerInfo: {
              firstName: customerInfo.firstName.trim(),
              lastName: customerInfo.lastName.trim(),
              email: (customerInfo.email || "").trim(),
              phone: customerInfo.phone.trim(),
              address: customerInfo.address.trim(),
              city: customerInfo.city.trim(),
              state: customerInfo.state.trim(),
              postalCode: customerInfo.postalCode.trim(),
            } as unknown as Prisma.InputJsonValue,
            wantsInstallation,
            deliveryFee,
            installationFee: resolvedInstallationFee,
            totalAmount,
            status: status || "pending",
            notes: notes?.trim() || "",
          },
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        });

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
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { page = "1", limit = "10", status } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const where = status && status !== "" ? { status: String(status) } : {};
        const totalOrders = await prisma.order.count({ where });

        // Get orders with pagination
        const orders = await prisma.order.findMany({
          where,
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        });

        // Calculate stats
        const totalOrdersCount = await prisma.order.count();
        const pendingOrdersCount = await prisma.order.count({ where: { status: "pending" } });
        const confirmedOrdersCount = await prisma.order.count({ where: { status: "confirmed" } });
        const processingOrdersCount = await prisma.order.count({
          where: { OR: [{ status: "processing" }, { status: "shipped" }] },
        });
        const deliveredOrdersCount = await prisma.order.count({ where: { status: "delivered" } });
        const cancelledOrdersCount = await prisma.order.count({ where: { status: "cancelled" } });

        return res.status(200).json({
          success: true,
          data: {
            orders: orders.map((o) => ({
              ...o,
              status: o.status === "shipped" ? "processing" : o.status,
              _id: o.id,
              userId: o.user ? { name: o.user.name, email: o.user.email } : null,
            })),
            pagination: {
              currentPage: pageNum,
              totalPages: Math.ceil(totalOrders / limitNum),
              totalOrders,
              hasNext: pageNum < Math.ceil(totalOrders / limitNum),
              hasPrev: pageNum > 1,
            },
            stats: {
              totalOrders: totalOrdersCount,
              pendingOrders: pendingOrdersCount,
              confirmedOrders: confirmedOrdersCount,
              processingOrders: processingOrdersCount,
              deliveredOrders: deliveredOrdersCount,
              cancelledOrders: cancelledOrdersCount,
            },
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
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { id } = req.query;
        const { status } = req.body;

        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "Order ID is required",
          });
        }

        const validStatuses = [
          "pending",
          "confirmed",
          "processing",
          "delivered",
          "cancelled",
        ];
        if (!status || !validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          });
        }

        // Update order status
        const existingOrder = await prisma.order.findUnique({ where: { id } });

        if (!existingOrder) {
          return res.status(404).json({
            success: false,
            error: "Order not found",
          });
        }

        const updatedOrder = await prisma.order.update({
          where: { id },
          data: { status },
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

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
