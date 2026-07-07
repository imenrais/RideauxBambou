import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireAdmin } from "../../../lib/auth-helpers";
import { prisma } from "../../../lib/prisma";

// Validation schema
const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  image: z
    .string()
    .min(1, "Image is required")
    .refine(
      (value) => {
        // Accept both URLs and relative paths starting with /uploads/
        return value.startsWith("http") || value.startsWith("/uploads/");
      },
      {
        message: "Invalid image URL",
      }
    ),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const products = await prisma.product.findMany({
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
          success: true,
          data: products.map((p) => ({ ...p, _id: p.id })),
        });
      } catch (error) {
        console.error("Products fetch error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch products",
        });
      }
    })(req, res);
  }

  if (req.method === "POST") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        // Validate input
        const validationResult = productSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: validationResult.error.issues[0].message,
          });
        }

        const productData = validationResult.data;

        // Check if product with same name exists
        const existingProduct = await prisma.product.findUnique({
          where: { name: productData.name },
        });
        if (existingProduct) {
          return res.status(400).json({
            success: false,
            error: "Product with this name already exists",
          });
        }

        // Create product
        const product = await prisma.product.create({
          data: {
            name: productData.name,
            image: productData.image,
            isActive: true,
          },
        });

        return res.status(201).json({
          success: true,
          data: { ...product, _id: product.id },
        });
      } catch (error) {
        console.error("Product creation error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to create product",
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
            error: "Product ID is required",
          });
        }

        // Validate input
        const validationResult = productSchema.partial().safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: validationResult.error.issues[0].message,
          });
        }

        const productData = validationResult.data;

        // Update product
        const existingProduct = await prisma.product.findUnique({ where: { id } });

        if (!existingProduct) {
          return res.status(404).json({
            success: false,
            error: "Product not found",
          });
        }

        const product = await prisma.product.update({
          where: { id },
          data: {
            ...(productData.name !== undefined ? { name: productData.name } : {}),
            ...(productData.image !== undefined ? { image: productData.image } : {}),
          },
        });

        return res.status(200).json({
          success: true,
          data: { ...product, _id: product.id },
        });
      } catch (error) {
        console.error("Product update error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update product",
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
            error: "Product ID is required",
          });
        }

        // Soft delete (set isActive to false)
        const existingProduct = await prisma.product.findUnique({ where: { id } });

        if (!existingProduct) {
          return res.status(404).json({
            success: false,
            error: "Product not found",
          });
        }

        await prisma.product.update({
          where: { id },
          data: { isActive: false },
        });

        return res.status(200).json({
          success: true,
          message: "Product deactivated successfully",
        });
      } catch (error) {
        console.error("Product deletion error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to delete product",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
