import { NextApiRequest, NextApiResponse } from "next";

import { setPublicCacheHeaders } from "../../lib/api-cache";
import { getPanneauConfig } from "../../lib/panneau-config-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const config = await getPanneauConfig();

    setPublicCacheHeaders(res, 60);

    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching panneau config:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch panneau configuration",
    });
  }
}
