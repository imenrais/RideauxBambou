import { prisma } from "./prisma";

// Global installation fee storage using database
let globalInstallationFee = 11;
let isInitialized = false;
let cachedInstallationFeeData: { fee: number; lastUpdated: string } | null = null;

const invalidateInstallationFeeCache = () => {
  cachedInstallationFeeData = null;
};

async function initializeFee() {
  if (isInitialized) return;

  try {
    let fee = await prisma.installationFee.findFirst();
    if (!fee) {
      fee = await prisma.installationFee.create({
        data: { fee: 11, updatedBy: "system", lastUpdated: new Date() },
      });
    }
    globalInstallationFee = fee.fee;
    isInitialized = true;
  } catch (error) {
    console.error("Error initializing installation fee:", error);
    // Keep default value if database fails
  }
}

export async function getGlobalInstallationFee(): Promise<number> {
  await initializeFee();
  return globalInstallationFee;
}

export async function setGlobalInstallationFee(
  fee: number,
  updatedBy: string = "system"
): Promise<void> {
  try {
    const existing = await prisma.installationFee.findFirst();
    const feeDoc = existing
      ? await prisma.installationFee.update({
          where: { id: existing.id },
          data: { fee, updatedBy, lastUpdated: new Date() },
        })
      : await prisma.installationFee.create({
          data: { fee, updatedBy, lastUpdated: new Date() },
        });
    globalInstallationFee = feeDoc.fee;
    invalidateInstallationFeeCache();
  } catch (error) {
    console.error("Error updating installation fee:", error);
    throw error;
  }
}

export async function getInstallationFeeData() {
  await initializeFee();

  if (cachedInstallationFeeData) {
    return cachedInstallationFeeData;
  }

  try {
    let fee = await prisma.installationFee.findFirst();
    if (!fee) {
      fee = await prisma.installationFee.create({
        data: { fee: globalInstallationFee, updatedBy: "system", lastUpdated: new Date() },
      });
    }
    cachedInstallationFeeData = {
      fee: fee.fee,
      lastUpdated: fee.lastUpdated.toISOString(),
    };
    return cachedInstallationFeeData;
  } catch (error) {
    console.error("Error fetching installation fee data:", error);
    return {
      fee: globalInstallationFee,
      lastUpdated: new Date().toISOString(),
    };
  }
}
