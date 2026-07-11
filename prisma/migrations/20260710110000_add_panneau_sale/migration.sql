-- AlterTable
ALTER TABLE "PanneauSettings" ADD COLUMN "isSaleActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PanneauWidth" ADD COLUMN "salePrice" DOUBLE PRECISION;
