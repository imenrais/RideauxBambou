import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../../../lib/auth-helpers";
import { optionalEmailSchema, requiredEmailSchema } from "../../../lib/email-validation";
import { strongPasswordSchema } from "../../../lib/password-validation";
import { prisma } from "../../../lib/prisma";

const createWorkerSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: requiredEmailSchema,
  role: z
    .string()
    .min(1, "Le rôle est requis")
    .transform((value) => value.trim().toLowerCase()),
  password: strongPasswordSchema,
});

const updateUserSchema = z
  .object({
    role: z
      .string()
      .min(1, "Le rôle est requis")
      .transform((value) => value.trim().toLowerCase())
      .optional(),
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").optional(),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
    email: optionalEmailSchema.optional(),
    password: strongPasswordSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Aucune donnée à mettre à jour",
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, _user) => {
      try {
        const validationResult = createWorkerSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: validationResult.error.issues[0].message,
          });
        }

        const { firstName, lastName, email, role, password } = validationResult.data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: "Un compte avec cet email existe déjà",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const worker = await prisma.user.create({
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`,
            email,
            password: hashedPassword,
            role,
          },
        });

        return res.status(201).json({
          success: true,
          data: {
            _id: worker.id,
            name: worker.name,
            email: worker.email,
            role: worker.role,
            createdAt: worker.createdAt,
          },
        });
      } catch (error) {
        console.error("Admin worker creation error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to create worker account",
        });
      }
    })(req, res);
  }

  if (req.method === "GET") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { page = "1", limit = "10", role } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build filter object
        const filter: any = {};
        if (role && role !== "") {
          filter.role = role;
        }

        // Get total count for pagination
        const totalUsers = await prisma.user.count({
          where: role && role !== "" ? { role: String(role) } : undefined,
        });

        // Get users with pagination
        const users = await prisma.user.findMany({
          where: role && role !== "" ? { role: String(role) } : undefined,
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        });

        // Calculate stats
        const totalUsersCount = await prisma.user.count();
        const adminUsersCount = await prisma.user.count({ where: { role: "admin" } });
        const regularUsersCount = await prisma.user.count({ where: { role: "user" } });
        const workerUsersCount = await prisma.user.count({ where: { role: "worker" } });

        const mappedUsers = users.map((u) => ({
          _id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
        }));

        return res.status(200).json({
          success: true,
          data: {
            users: mappedUsers,
            pagination: {
              currentPage: pageNum,
              totalPages: Math.ceil(totalUsers / limitNum),
              totalUsers,
              hasNext: pageNum < Math.ceil(totalUsers / limitNum),
              hasPrev: pageNum > 1,
            },
            stats: {
              totalUsers: totalUsersCount,
              adminUsers: adminUsersCount,
              regularUsers: regularUsersCount,
              workerUsers: workerUsersCount,
            },
          },
        });
      } catch (error) {
        console.error("Admin users fetch error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch users",
        });
      }
    })(req, res);
  }

  if (req.method === "PUT") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, user) => {
      try {
        const { id } = req.query;

        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "User ID is required",
          });
        }

        const validationResult = updateUserSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: validationResult.error.issues[0].message,
          });
        }

        const { role, firstName, lastName, email, password } = validationResult.data;

        // Update user role
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
          return res.status(404).json({
            success: false,
            error: "User not found",
          });
        }

        if (id === user.id && (role || firstName || lastName || email || password)) {
          return res.status(403).json({
            success: false,
            error: "Admin self-update is not allowed from this endpoint",
          });
        }

        const updateData: Record<string, unknown> = {};

        if (role) {
          updateData.role = role;
        }

        const workerDetailsRequested = firstName !== undefined || lastName !== undefined || email !== undefined || password !== undefined;
        if (workerDetailsRequested) {
          if (existingUser.role !== "worker") {
            return res.status(403).json({
              success: false,
              error: "Only worker accounts can be edited from this endpoint",
            });
          }

          if (firstName !== undefined) {
            updateData.firstName = firstName.trim();
          }
          if (lastName !== undefined) {
            updateData.lastName = lastName.trim();
          }
          if (firstName !== undefined || lastName !== undefined) {
            const resolvedFirstName =
              (firstName !== undefined ? firstName : existingUser.firstName || "").trim();
            const resolvedLastName =
              (lastName !== undefined ? lastName : existingUser.lastName || "").trim();
            updateData.name = `${resolvedFirstName} ${resolvedLastName}`.trim();
          }

          if (email !== undefined) {
            const emailConflict = await prisma.user.findFirst({
              where: {
                email,
                id: { not: id },
              },
            });
            if (emailConflict) {
              return res.status(400).json({
                success: false,
                error: "Un compte avec cet email existe déjà",
              });
            }
            updateData.email = email;
          }

          if (password !== undefined) {
            updateData.password = await bcrypt.hash(password, 12);
          }
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        });

        return res.status(200).json({
          success: true,
          data: {
            _id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
          },
        });
      } catch (error) {
        console.error("Admin user update error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to update user",
        });
      }
    })(req, res);
  }

  if (req.method === "DELETE") {
    return requireAdmin(async (req: NextApiRequest, res: NextApiResponse, currentAdmin) => {
      try {
        const { id } = req.query;

        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (id === currentAdmin.id) {
          return res.status(403).json({
            success: false,
            error: "You cannot delete your own admin account",
          });
        }

        const userToDelete = await prisma.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        });

        if (!userToDelete) {
          return res.status(404).json({
            success: false,
            error: "User not found",
          });
        }

        if (userToDelete.role !== "worker") {
          return res.status(403).json({
            success: false,
            error: "Only worker accounts can be deleted from this endpoint",
          });
        }

        await prisma.user.delete({
          where: { id: userToDelete.id },
        });

        return res.status(200).json({
          success: true,
          message: "Worker account deleted successfully",
        });
      } catch (error) {
        console.error("Admin worker delete error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to delete worker account",
        });
      }
    })(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}
