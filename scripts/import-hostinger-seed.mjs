/**
 * Import Hostinger seed into the target DATABASE_URL.
 * Does not touch orders/reviews. Upserts by id / unique keys.
 *
 * Usage (on VPS after migrate deploy):
 *   DATABASE_URL=... node scripts/import-hostinger-seed.mjs
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });
config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const seedPath = path.join(process.cwd(), "data", "hostinger-seed.json");
  if (!existsSync(seedPath)) {
    throw new Error(`Missing ${seedPath} — run export-hostinger-seed.mjs first`);
  }

  const seed = JSON.parse(readFileSync(seedPath, "utf8"));

  const asDate = (value) => (value ? new Date(value) : value);
  const reviveUser = (user) => ({
    ...user,
    resetPasswordExpiry: asDate(user.resetPasswordExpiry),
    createdAt: asDate(user.createdAt),
    updatedAt: asDate(user.updatedAt),
  });
  const reviveDates = (row, fields) => {
    const next = { ...row };
    for (const field of fields) {
      if (next[field] != null) {
        next[field] = asDate(next[field]);
      }
    }
    return next;
  };

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    for (const user of seed.users || []) {
      const data = reviveUser(user);
      await prisma.user.upsert({
        where: { id: data.id },
        create: data,
        update: {
          firstName: data.firstName,
          lastName: data.lastName,
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          resetPasswordToken: data.resetPasswordToken,
          resetPasswordExpiry: data.resetPasswordExpiry,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const product of seed.products || []) {
      const data = reviveDates(product, ["createdAt", "updatedAt"]);
      await prisma.product.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          image: data.image,
          isActive: data.isActive,
          isAvailable: data.isAvailable,
          supportsPanneau: data.supportsPanneau,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const price of seed.prices || []) {
      const data = reviveDates(price, ["lastUpdated", "createdAt", "updatedAt"]);
      await prisma.price.upsert({
        where: { id: data.id },
        create: data,
        update: {
          pricePerM2: data.pricePerM2,
          salePricePerM2: data.salePricePerM2,
          isSaleActive: data.isSaleActive,
          panneauPrice100cm: data.panneauPrice100cm,
          panneauPrice130cm: data.panneauPrice130cm,
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const fee of seed.installationFees || []) {
      const data = reviveDates(fee, ["lastUpdated", "createdAt", "updatedAt"]);
      await prisma.installationFee.upsert({
        where: { id: data.id },
        create: data,
        update: {
          fee: data.fee,
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const fee of seed.deliveryFees || []) {
      const data = reviveDates(fee, ["lastUpdated", "createdAt", "updatedAt"]);
      await prisma.deliveryFee.upsert({
        where: { id: data.id },
        create: data,
        update: {
          state: data.state,
          stateCode: data.stateCode,
          fee: data.fee,
          isActive: data.isActive,
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const settings of seed.deliveryFeeSettings || []) {
      const data = reviveDates(settings, ["lastUpdated"]);
      await prisma.deliveryFeeSettings.upsert({
        where: { id: data.id },
        create: data,
        update: {
          isFreeDeliveryActive: data.isFreeDeliveryActive,
          feeBackup: data.feeBackup,
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
        },
      });
    }

    for (const settings of seed.panneauSettings || []) {
      const data = reviveDates(settings, ["lastUpdated", "createdAt", "updatedAt"]);
      await prisma.panneauSettings.upsert({
        where: { id: data.id },
        create: data,
        update: {
          fixedHeightCm: data.fixedHeightCm,
          isSaleActive: data.isSaleActive,
          updatedBy: data.updatedBy,
          lastUpdated: data.lastUpdated,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const width of seed.panneauWidths || []) {
      const data = reviveDates(width, ["createdAt", "updatedAt"]);
      await prisma.panneauWidth.upsert({
        where: { id: data.id },
        create: data,
        update: {
          widthCm: data.widthCm,
          label: data.label,
          price: data.price,
          salePrice: data.salePrice,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          updatedAt: data.updatedAt,
        },
      });
    }

    for (const subscriber of seed.promoSubscribers || []) {
      const data = reviveDates(subscriber, ["createdAt", "updatedAt"]);
      await prisma.promoSubscriber.upsert({
        where: { id: data.id },
        create: data,
        update: {
          email: data.email,
          source: data.source,
          isActive: data.isActive,
          updatedAt: data.updatedAt,
        },
      });
    }

    console.log("Import complete:", seed.counts || {});
    console.log("Orders and reviews were not imported.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
