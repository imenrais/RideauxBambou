import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

interface ProductResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

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
    });

    // Transform the data to match the expected format
    const transformedProducts = products.map((product) => ({
      _id: product.id,
      name: product.name,
      image: product.image,
      createdAt: product.createdAt,
    }));

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
