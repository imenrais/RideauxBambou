import { NextApiRequest, NextApiResponse } from "next";

/**
 * Minimal health endpoint — no stack/runtime details for public probes.
 * Optional HEALTHCHECK_TOKEN via x-health-token header for richer monitoring status.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false });
  }

  res.setHeader("Cache-Control", "no-store");

  const token =
    typeof req.headers["x-health-token"] === "string" ? req.headers["x-health-token"] : "";
  const expected = process.env.HEALTHCHECK_TOKEN?.trim() || "";
  const isTrusted = Boolean(expected) && token === expected;

  if (!isTrusted) {
    return res.status(200).json({ ok: true });
  }

  try {
    const { prisma } = await import("../../lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      ok: true,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      ok: false,
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
}
