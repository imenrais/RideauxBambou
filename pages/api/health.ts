import { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    // Check database connection
    await connectDB();

    // Basic health check
    const healthStatus = {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "0.1.0",
      database: "connected",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      platform: process.platform,
      nodeVersion: process.version,
    };

    return res.status(200).json(healthStatus);
  } catch (error) {
    console.error("Health check failed:", error);

    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      database: "disconnected",
    });
  }
}
