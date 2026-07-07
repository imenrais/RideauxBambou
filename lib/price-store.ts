import { prisma } from "./prisma";

// Global price storage using database
let globalPricePerM2 = 50;
let isInitialized = false;

async function initializePrice() {
  if (isInitialized) return;

  try {
    let price = await prisma.price.findFirst();
    if (!price) {
      price = await prisma.price.create({
        data: {
          pricePerM2: 50,
          updatedBy: "system",
          lastUpdated: new Date(),
        },
      });
    }
    globalPricePerM2 = price.pricePerM2;
    isInitialized = true;
  } catch (error) {
    console.error("Error initializing price:", error);
    // Keep default value if database fails
  }
}

export async function getGlobalPrice(): Promise<number> {
  await initializePrice();
  return globalPricePerM2;
}

export async function setGlobalPrice(price: number, updatedBy: string = "system"): Promise<void> {
  try {
    const existing = await prisma.price.findFirst();
    const priceDoc = existing
      ? await prisma.price.update({
          where: { id: existing.id },
          data: { pricePerM2: price, updatedBy, lastUpdated: new Date() },
        })
      : await prisma.price.create({
          data: { pricePerM2: price, updatedBy, lastUpdated: new Date() },
        });
    globalPricePerM2 = priceDoc.pricePerM2;
  } catch (error) {
    console.error("Error updating price:", error);
    throw error;
  }
}

export async function getPriceData() {
  try {
    let price = await prisma.price.findFirst();
    if (!price) {
      price = await prisma.price.create({
        data: {
          pricePerM2: globalPricePerM2,
          updatedBy: "system",
          lastUpdated: new Date(),
        },
      });
    }
    return {
      pricePerM2: price.pricePerM2,
      lastUpdated: price.lastUpdated.toISOString(),
    };
  } catch (error) {
    console.error("Error fetching price data:", error);
    return {
      pricePerM2: globalPricePerM2,
      lastUpdated: new Date().toISOString(),
    };
  }
}
