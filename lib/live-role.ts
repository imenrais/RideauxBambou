import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "./prisma";

/**
 * Re-read role from DB so demotions apply immediately (not only after JWT refresh).
 */
export async function getLiveUserRole(
  userId: string
): Promise<"user" | "worker" | "admin" | null> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!dbUser) {
      return null;
    }
    const role = dbUser.role;
    if (role === "admin" || role === "worker" || role === "user") {
      return role;
    }
    return "user";
  } catch (error) {
    console.error("Live role lookup failed:", error);
    return null;
  }
}
