-- AlterTable
ALTER TABLE "Product" ADD COLUMN "supportsPanneau" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PanneauSettings" (
    "id" TEXT NOT NULL,
    "fixedHeightCm" INTEGER NOT NULL DEFAULT 220,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanneauSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanneauWidth" (
    "id" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "label" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanneauWidth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PanneauWidth_widthCm_key" ON "PanneauWidth"("widthCm");

-- Seed default settings row
INSERT INTO "PanneauSettings" ("id", "fixedHeightCm", "updatedBy", "lastUpdated", "updatedAt")
VALUES ('default', 220, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Mark existing Référence 300 product as panneau-eligible when present
UPDATE "Product"
SET "supportsPanneau" = true
WHERE trim("name") = 'Référence 300';
