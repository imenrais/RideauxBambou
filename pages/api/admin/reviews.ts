import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireAdmin } from "../../../lib/auth-helpers";
import { prisma } from "../../../lib/prisma";

const reviewSchema = z.object({
  image: z
    .string()
    .min(1, "L'image est requise")
    .refine((value) => value.startsWith("http") || value.startsWith("/uploads/"), {
      message: "L'URL de l'image doit etre valide",
    }),
  caption: z.string().max(240, "Le texte ne doit pas depasser 240 caracteres").optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1, "La liste des avis est requise"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return requireAdmin(async (_req: NextApiRequest, response: NextApiResponse) => {
      try {
        const reviews = await prisma.review.findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        });
        return response.status(200).json({
          success: true,
          data: reviews.map((r) => ({ ...r, _id: r.id })),
        });
      } catch (error) {
        console.error("Reviews fetch error:", error);
        return response.status(500).json({ success: false, error: "Failed to fetch reviews" });
      }
    })(req, res);
  }

  if (req.method === "POST") {
    return requireAdmin(async (_req: NextApiRequest, response: NextApiResponse) => {
      try {
        const validation = reviewSchema.safeParse(req.body);
        if (!validation.success) {
          return response
            .status(400)
            .json({ success: false, error: validation.error.issues[0].message });
        }

        const lastReview = await prisma.review.findFirst({
          orderBy: { order: "desc" },
        });
        const nextOrder = (lastReview?.order ?? -1) + 1;

        const review = await prisma.review.create({
          data: {
            image: validation.data.image,
            caption: validation.data.caption || "",
            order: nextOrder,
            isActive: validation.data.isActive ?? true,
          },
        });

        return response.status(201).json({ success: true, data: { ...review, _id: review.id } });
      } catch (error) {
        console.error("Review creation error:", error);
        return response.status(500).json({ success: false, error: "Failed to create review" });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (_req: NextApiRequest, response: NextApiResponse) => {
      try {
        const { id } = req.query;

        // Bulk reorder mode
        if (!id) {
          const reorderValidation = reorderSchema.safeParse(req.body);
          if (!reorderValidation.success) {
            return response
              .status(400)
              .json({ success: false, error: reorderValidation.error.issues[0].message });
          }

          const { orderedIds } = reorderValidation.data;

          const operations = orderedIds.map((reviewId, index) => ({
            updateOne: {
              filter: { _id: reviewId },
              update: { $set: { order: index } },
            },
          }));

          if (operations.length > 0) {
            await prisma.$transaction(
              operations.map((op) =>
                prisma.review.update({
                  where: { id: String(op.updateOne.filter._id) },
                  data: { order: op.updateOne.update.$set.order },
                })
              )
            );
          }

          const reviews = await prisma.review.findMany({
            where: { isActive: true },
            orderBy: [{ order: "asc" }, { createdAt: "desc" }],
          });
          return response.status(200).json({
            success: true,
            data: reviews.map((r) => ({ ...r, _id: r.id })),
          });
        }

        if (typeof id !== "string") {
          return response.status(400).json({ success: false, error: "Review ID is required" });
        }

        const validation = reviewSchema.partial().safeParse(req.body);
        if (!validation.success) {
          return response
            .status(400)
            .json({ success: false, error: validation.error.issues[0].message });
        }

        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return response.status(404).json({ success: false, error: "Review not found" });
        }

        const review = await prisma.review.update({
          where: { id },
          data: validation.data,
        });

        return response.status(200).json({ success: true, data: { ...review, _id: review.id } });
      } catch (error) {
        console.error("Review update error:", error);
        return response.status(500).json({ success: false, error: "Failed to update review" });
      }
    })(req, res);
  }

  if (req.method === "DELETE") {
    return requireAdmin(async (_req: NextApiRequest, response: NextApiResponse) => {
      try {
        const { id } = req.query;
        if (!id || typeof id !== "string") {
          return response.status(400).json({ success: false, error: "Review ID is required" });
        }

        const existingReview = await prisma.review.findUnique({ where: { id } });
        if (!existingReview) {
          return response.status(404).json({ success: false, error: "Review not found" });
        }

        await prisma.review.delete({ where: { id } });

        return response.status(200).json({ success: true, message: "Review deleted" });
      } catch (error) {
        console.error("Review delete error:", error);
        return response.status(500).json({ success: false, error: "Failed to delete review" });
      }
    })(req, res);
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
