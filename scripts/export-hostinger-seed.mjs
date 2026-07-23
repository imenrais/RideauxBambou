/**
 * Export local DB seed for Hostinger (no orders, no reviews/avis).
 * Keeps: users (admin), products (+ Cloudinary image URLs), prices, fees, panneau, newsletter.
 *
 * Usage: node scripts/export-hostinger-seed.mjs
 * Output: data/hostinger-seed.json (gitignored — contains password hashes)
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [
      users,
      products,
      prices,
      installationFees,
      deliveryFees,
      deliveryFeeSettings,
      panneauSettings,
      panneauWidths,
      promoSubscribers,
    ] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.price.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.installationFee.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.deliveryFee.findMany({ orderBy: { state: "asc" } }),
      prisma.deliveryFeeSettings.findMany(),
      prisma.panneauSettings.findMany(),
      prisma.panneauWidth.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.promoSubscriber.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    const seed = {
      exportedAt: new Date().toISOString(),
      excludes: ["orders", "reviews"],
      counts: {
        users: users.length,
        products: products.length,
        prices: prices.length,
        installationFees: installationFees.length,
        deliveryFees: deliveryFees.length,
        deliveryFeeSettings: deliveryFeeSettings.length,
        panneauSettings: panneauSettings.length,
        panneauWidths: panneauWidths.length,
        promoSubscribers: promoSubscribers.length,
        admins: users.filter((u) => u.role === "admin").length,
      },
      users,
      products,
      prices,
      installationFees,
      deliveryFees,
      deliveryFeeSettings,
      panneauSettings,
      panneauWidths,
      promoSubscribers,
    };

    const outDir = path.join(process.cwd(), "data");
    mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "hostinger-seed.json");
    writeFileSync(outFile, JSON.stringify(seed, null, 2), "utf8");

    console.log("Exported:", seed.counts);
    console.log("Wrote:", outFile);
    console.log("Skipped: orders, reviews (avis pictures)");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Export failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
