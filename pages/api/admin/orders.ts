import { Prisma } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireAdmin } from "../../../lib/auth-helpers";
import { optionalEmailSchema } from "../../../lib/email-validation";
import { subscribePromoEmail } from "../../../lib/promo-subscriber-store";
import { requiredPhoneSchema } from "../../../lib/phone-validation";
import { prisma } from "../../../lib/prisma";

const LEGACY_STATUS_MAP: Record<string, string> = {
  shipped: "processing",
};

const normalizeOrderStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return LEGACY_STATUS_MAP[normalized] || normalized;
};

const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const normalizePhoneDigits = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 8) {
    return digits.slice(-8);
  }
  return digits;
};

const buildCustomerNameCandidates = (
  customerInfo: Record<string, unknown>,
  user?: { name?: string | null } | null
) => {
  const firstName = normalizeSearchText(customerInfo.firstName);
  const lastName = normalizeSearchText(customerInfo.lastName);
  const legacyName = normalizeSearchText(customerInfo.name);
  const accountName = normalizeSearchText(user?.name);

  return [...new Set([`${firstName} ${lastName}`.trim(), legacyName, accountName].filter(Boolean))];
};

const matchesCustomerName = (nameCandidates: string[], searchTokens: string[]) => {
  if (searchTokens.length === 0) {
    return false;
  }

  const nameParts = nameCandidates
    .flatMap((candidate) => candidate.split(/\s+/))
    .filter((part) => part.length > 0);

  return searchTokens.every(
    (token) =>
      nameCandidates.some((candidate) => candidate.includes(token)) ||
      nameParts.some((part) => part.startsWith(token))
  );
};

const matchesCustomerPhone = (phoneValue: unknown, digitsSearch: string) => {
  if (digitsSearch.length < 3) {
    return false;
  }

  const phoneDigits = normalizePhoneDigits(phoneValue);
  return phoneDigits.includes(digitsSearch);
};

const matchesOrderIdSearch = (orderId: string, query: string) => {
  const normalizedQuery = query.replace(/\s/g, "");
  if (!normalizedQuery) {
    return false;
  }

  const normalizedOrderId = normalizeSearchText(orderId).replace(/\s/g, "");
  const shortOrderId = normalizedOrderId.slice(-8);

  return shortOrderId.includes(normalizedQuery) || normalizedOrderId.includes(normalizedQuery);
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

const createAdminOrderSchema = z.object({
  customerInfo: z.object({
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: optionalEmailSchema.optional(),
    phone: requiredPhoneSchema,
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

        const { customerInfo, item, wantsInstallation, deliveryFee, installationFee, notes } =
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
              email: customerInfo.email || "",
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
        const normalizedSearch = normalizeSearchText(search);
        const normalizedOrderIdLookup = normalizeSearchText(orderId).replace(/\s/g, "");
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
            const searchTokens = normalizedSearch.split(" ").filter((token) => token.length > 0);
            const compactSearch = normalizedSearch.replace(/\s/g, "");
            const digitsSearch = normalizedSearch.replace(/\D/g, "");

            const allFilteredByStatus = await prisma.order.findMany({
              where,
              include: orderInclude,
              orderBy: { createdAt: "desc" },
            });

            const searchedOrders = allFilteredByStatus.filter((order) => {
              const customerInfo = (order.customerInfo || {}) as Record<string, unknown>;
              const nameCandidates = buildCustomerNameCandidates(customerInfo, order.user);
              const matchesName = matchesCustomerName(nameCandidates, searchTokens);
              const matchesPhone = matchesCustomerPhone(customerInfo.phone, digitsSearch);
              const matchesOrderId = matchesOrderIdSearch(order.id, compactSearch);

              return matchesName || matchesPhone || matchesOrderId;
            });

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
