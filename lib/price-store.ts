import {
  DEFAULT_PANNEAU_PRICE_100CM,
  DEFAULT_PANNEAU_PRICE_130CM,
  type PanneauPriceSettings,
} from "./panneau-pricing";
import { getEffectivePricePerM2 } from "./pricing";
import { prisma } from "./prisma";

// Global price storage using database
let globalPricePerM2 = 50;
let isInitialized = false;
let cachedPriceData: Awaited<ReturnType<typeof buildPriceDataFromDb>> | null = null;

const invalidatePriceCache = () => {
  cachedPriceData = null;
};

async function initializePrice() {
  if (isInitialized) return;

  try {
    let price = await prisma.price.findFirst();
    if (!price) {
      price = await prisma.price.create({
        data: {
          pricePerM2: 50,
          panneauPrice100cm: DEFAULT_PANNEAU_PRICE_100CM,
          panneauPrice130cm: DEFAULT_PANNEAU_PRICE_130CM,
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
    invalidatePriceCache();
  } catch (error) {
    console.error("Error updating price:", error);
    throw error;
  }
}

export async function updatePanneauPrices(
  panneauPrice100cm: number,
  panneauPrice130cm: number,
  updatedBy: string = "system"
): Promise<void> {
  try {
    const existing = await prisma.price.findFirst();
    if (!existing) {
      await prisma.price.create({
        data: {
          pricePerM2: globalPricePerM2,
          panneauPrice100cm,
          panneauPrice130cm,
          updatedBy,
          lastUpdated: new Date(),
        },
      });
      invalidatePriceCache();
      return;
    }

    await prisma.price.update({
      where: { id: existing.id },
      data: {
        panneauPrice100cm,
        panneauPrice130cm,
        updatedBy,
        lastUpdated: new Date(),
      },
    });
    invalidatePriceCache();
  } catch (error) {
    console.error("Error updating panneau prices:", error);
    throw error;
  }
}

export async function updateSaleSettings(
  salePricePerM2: number | null,
  isSaleActive: boolean,
  updatedBy: string = "system"
): Promise<void> {
  try {
    const existing = await prisma.price.findFirst();
    if (!existing) {
      await prisma.price.create({
        data: {
          pricePerM2: globalPricePerM2,
          salePricePerM2,
          isSaleActive,
          updatedBy,
          lastUpdated: new Date(),
        },
      });
      invalidatePriceCache();
      return;
    }

    await prisma.price.update({
      where: { id: existing.id },
      data: {
        salePricePerM2,
        isSaleActive,
        updatedBy,
        lastUpdated: new Date(),
      },
    });
    invalidatePriceCache();
  } catch (error) {
    console.error("Error updating sale settings:", error);
    throw error;
  }
}

export async function getPriceData() {
  await initializePrice();

  if (cachedPriceData) {
    return cachedPriceData;
  }

  cachedPriceData = await buildPriceDataFromDb();
  return cachedPriceData;
}

async function buildPriceDataFromDb() {
  try {
    let price = await prisma.price.findFirst();
    if (!price) {
      price = await prisma.price.create({
        data: {
          pricePerM2: globalPricePerM2,
          panneauPrice100cm: DEFAULT_PANNEAU_PRICE_100CM,
          panneauPrice130cm: DEFAULT_PANNEAU_PRICE_130CM,
          updatedBy: "system",
          lastUpdated: new Date(),
        },
      });
    }

    const settings = {
      pricePerM2: price.pricePerM2,
      salePricePerM2: price.salePricePerM2 ?? null,
      isSaleActive: price.isSaleActive === true,
    };
    const panneauPrices: PanneauPriceSettings = {
      panneauPrice100cm: price.panneauPrice100cm ?? DEFAULT_PANNEAU_PRICE_100CM,
      panneauPrice130cm: price.panneauPrice130cm ?? DEFAULT_PANNEAU_PRICE_130CM,
    };

    return {
      ...settings,
      ...panneauPrices,
      effectivePricePerM2: getEffectivePricePerM2(settings),
      lastUpdated: price.lastUpdated.toISOString(),
    };
  } catch (error) {
    console.error("Error fetching price data:", error);
    const fallbackSettings = {
      pricePerM2: globalPricePerM2,
      salePricePerM2: null,
      isSaleActive: false,
    };
    return {
      ...fallbackSettings,
      panneauPrice100cm: DEFAULT_PANNEAU_PRICE_100CM,
      panneauPrice130cm: DEFAULT_PANNEAU_PRICE_130CM,
      effectivePricePerM2: getEffectivePricePerM2(fallbackSettings),
      lastUpdated: new Date().toISOString(),
    };
  }
}
