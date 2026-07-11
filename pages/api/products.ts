import { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "../../lib/prisma";
import { setPublicCacheHeaders } from "../../lib/api-cache";

interface ProductResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

const normalizeAvailability = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    if (normalized === "true" || normalized === "1") {
      return true;
    }
  }

  if (typeof value === "number") {
    if (value === 0) {
      return false;
    }
    if (value === 1) {
      return true;
    }
  }

  return true;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ProductResponse>) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        image: true,
        isAvailable: true,
        supportsPanneau: true,
        createdAt: true,
      },
    });

    // Transform the data to match the expected format
    const transformedProducts = products.map((product) => ({
      _id: product.id,
      name: product.name,
      image: product.image,
      isAvailable: normalizeAvailability(product.isAvailable),
      supportsPanneau: product.supportsPanneau === true,
      createdAt: product.createdAt,
    }));

    setPublicCacheHeaders(res, 60);

    return res.status(200).json({
      success: true,
      data: transformedProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch products",
    });
  }
}
