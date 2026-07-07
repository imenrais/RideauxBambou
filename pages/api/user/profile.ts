import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]";

const profileUpdateSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters").optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters").optional(),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch profile",
      });
    }
  }

  if (req.method === "PUT") {
    try {
      if (session.user.role === "worker") {
        return res.status(403).json({
          success: false,
          error: "Les comptes travailleurs sont gérés uniquement par l'administrateur",
        });
      }

      const validationResult = profileUpdateSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const updateData = validationResult.data;

      // Check if email is being updated and if it's already taken
      if (updateData.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: updateData.email,
            id: { not: session.user.id },
          },
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: "Email already in use",
          });
        }
      }

      const user = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...updateData,
          ...(updateData.firstName || updateData.lastName
            ? {
                name: `${updateData.firstName || session.user.firstName} ${updateData.lastName || session.user.lastName}`.trim(),
              }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update profile",
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
