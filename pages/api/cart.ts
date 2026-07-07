import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth-config";
import { prisma } from "../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { productId, quantity = 1, dimensions, width, height } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "Product ID is required",
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // For simple products, we'll create a basic cart item
    // This is a simplified approach - in a real app you might want to store cart items in the database
    const cartItem = {
      id: `${productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId,
      productName: product.name,
      productImage: product.image,
      quantity,
      dimensions: dimensions || "Standard",
      width: width || 100, // Default width
      height: height || 200, // Default height
      addedAt: new Date(),
    };

    // In a real application, you would save this to a Cart model in the database
    // For now, we'll just return success and let the frontend handle localStorage

    return res.status(200).json({
      success: true,
      data: cartItem,
      message: "Item added to cart successfully",
    });
  } catch (error) {
    console.error("Cart API error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to add item to cart",
    });
  }
}



