-- CreateTable
CREATE TABLE "DeliveryFeeSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isFreeDeliveryActive" BOOLEAN NOT NULL DEFAULT false,
    "feeBackup" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "DeliveryFeeSettings_pkey" PRIMARY KEY ("id")
);
