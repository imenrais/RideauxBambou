import { NextApiRequest, NextApiResponse } from "next";

import { setPublicCacheHeaders } from "../../lib/api-cache";
import { prisma } from "../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const reviews = await prisma.review.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    setPublicCacheHeaders(res, 300);

    return res.status(200).json({
      success: true,
      data: reviews.map((r) => ({ ...r, _id: r.id })),
    });
  } catch (error) {
    console.error("Public reviews fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch reviews" });
  }
}
