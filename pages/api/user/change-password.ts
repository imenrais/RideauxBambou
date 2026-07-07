import bcrypt from "bcryptjs";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { strongPasswordSchema } from "../../../lib/password-validation";
import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "La confirmation ne correspond pas au nouveau mot de passe",
    path: ["confirmPassword"],
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (session.user.role === "worker") {
    return res.status(403).json({
      success: false,
      error: "Le mot de passe des travailleurs est modifié uniquement par l'administrateur",
    });
  }

  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || "Données invalides",
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable" });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(400).json({ success: false, error: "Mot de passe actuel incorrect" });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res
        .status(400)
        .json({ success: false, error: "Le nouveau mot de passe doit être différent" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return res.status(200).json({ success: true, message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur" });
  }
}
