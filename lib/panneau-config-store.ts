import { prisma } from "./prisma";
import {
  DEFAULT_PANNEAU_PRICE_100CM,
  DEFAULT_PANNEAU_PRICE_130CM,
  cmToPanneauLabel,
  type PanneauConfig,
  type PanneauWidthConfig,
  type PanneauWidthInput,
} from "./panneau-types";

export type { PanneauConfig, PanneauWidthConfig, PanneauWidthInput };

let cachedConfig: PanneauConfig | null = null;

const normalizeSalePrice = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

async function ensurePanneauSettings() {
  const existing = await prisma.panneauSettings.findUnique({ where: { id: "default" } });

  if (!existing) {
    await prisma.panneauSettings.create({
      data: {
        id: "default",
        fixedHeightCm: 220,
        isSaleActive: false,
        updatedBy: "system",
      },
    });
  }
}

async function seedWidthsFromLegacyPrices() {
  const price = await prisma.price.findFirst({ orderBy: { lastUpdated: "desc" } });
  const price100 = price?.panneauPrice100cm ?? DEFAULT_PANNEAU_PRICE_100CM;
  const price130 = price?.panneauPrice130cm ?? DEFAULT_PANNEAU_PRICE_130CM;

  await prisma.panneauWidth.createMany({
    data: [
      { widthCm: 100, label: "1m", price: price100, sortOrder: 0 },
      { widthCm: 130, label: "1m30", price: price130, sortOrder: 1 },
    ],
    skipDuplicates: true,
  });
}

async function syncLegacyPanneauPrices(widths: PanneauWidthInput[]) {
  const width100 = widths.find((width) => Math.round(width.widthCm) === 100);
  const width130 = widths.find((width) => Math.round(width.widthCm) === 130);

  if (!width100 && !width130) {
    return;
  }

  const currentPrice = await prisma.price.findFirst({ orderBy: { lastUpdated: "desc" } });

  if (!currentPrice) {
    return;
  }

  await prisma.price.update({
    where: { id: currentPrice.id },
    data: {
      ...(width100 ? { panneauPrice100cm: width100.price } : {}),
      ...(width130 ? { panneauPrice130cm: width130.price } : {}),
      lastUpdated: new Date(),
    },
  });
}

export async function ensurePanneauConfigInitialized() {
  await ensurePanneauSettings();

  const count = await prisma.panneauWidth.count();
  if (count === 0) {
    await seedWidthsFromLegacyPrices();
  }
}

function mapWidths(
  widths: Array<{
    id: string;
    widthCm: number;
    label: string | null;
    price: number;
    salePrice: number | null;
    sortOrder: number;
    isActive: boolean;
  }>
): PanneauWidthConfig[] {
  return widths.map((width) => ({
    id: width.id,
    widthCm: width.widthCm,
    label: width.label,
    price: width.price,
    salePrice: width.salePrice,
    sortOrder: width.sortOrder,
    isActive: width.isActive,
  }));
}

export async function getPanneauConfig(): Promise<PanneauConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  await ensurePanneauConfigInitialized();

  const settings = await prisma.panneauSettings.findUnique({ where: { id: "default" } });
  const widths = await prisma.panneauWidth.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { widthCm: "asc" }],
  });

  cachedConfig = {
    fixedHeightCm: settings?.fixedHeightCm ?? 220,
    isSaleActive: settings?.isSaleActive === true,
    widths: mapWidths(widths),
    lastUpdated: settings?.lastUpdated?.toISOString(),
  };

  return cachedConfig;
}

function validateSalePrices(
  widths: Array<{ widthCm: number; price: number; salePrice: number | null }>,
  isSaleActive: boolean
) {
  if (!isSaleActive) {
    return;
  }

  for (const width of widths) {
    if (width.salePrice === null) {
      continue;
    }

    if (width.salePrice >= width.price) {
      throw new Error(
        `Le prix promotionnel pour ${width.widthCm} cm doit être inférieur au prix catalogue.`
      );
    }
  }
}

export async function setPanneauSaleActive(isSaleActive: boolean, updatedBy: string) {
  await ensurePanneauConfigInitialized();

  await prisma.panneauSettings.update({
    where: { id: "default" },
    data: {
      isSaleActive,
      updatedBy,
      lastUpdated: new Date(),
    },
  });

  cachedConfig = null;
  return getPanneauConfig();
}

export async function updatePanneauPromo(
  widths: Array<{ widthCm: number; salePrice: number | null }>,
  isSaleActive: boolean,
  updatedBy: string
) {
  await ensurePanneauConfigInitialized();

  const [existingWidths, settings] = await Promise.all([
    prisma.panneauWidth.findMany({
      where: { isActive: true },
    }),
    prisma.panneauSettings.findUnique({ where: { id: "default" } }),
  ]);

  const normalized = widths.map((width) => {
    const widthCm = Math.round(Number(width.widthCm));
    const existing = existingWidths.find((entry) => entry.widthCm === widthCm);

    if (!existing) {
      throw new Error(`Largeur panneau ${widthCm} cm introuvable.`);
    }

    const salePrice = normalizeSalePrice(width.salePrice);

    return {
      widthCm,
      price: existing.price,
      salePrice,
    };
  });

  validateSalePrices(normalized, isSaleActive);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.panneauSettings.update({
      where: { id: "default" },
      data: {
        isSaleActive,
        updatedBy,
        lastUpdated: now,
      },
    });

    await Promise.all(
      normalized.map((width) =>
        tx.panneauWidth.update({
          where: { widthCm: width.widthCm },
          data: { salePrice: width.salePrice },
        })
      )
    );
  });

  const saleByWidth = new Map(normalized.map((width) => [width.widthCm, width.salePrice]));

  cachedConfig = {
    fixedHeightCm: settings?.fixedHeightCm ?? 220,
    isSaleActive,
    lastUpdated: now.toISOString(),
    widths: mapWidths(
      existingWidths
        .map((width) => ({
          ...width,
          salePrice: saleByWidth.has(width.widthCm)
            ? (saleByWidth.get(width.widthCm) ?? null)
            : width.salePrice,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.widthCm - b.widthCm)
    ),
  };

  return cachedConfig;
}

export async function replacePanneauConfig(
  fixedHeightCm: number,
  widths: PanneauWidthInput[],
  updatedBy: string,
  isSaleActive?: boolean
): Promise<PanneauConfig> {
  const normalizedFixedHeight = Math.round(Number(fixedHeightCm));
  if (!Number.isFinite(normalizedFixedHeight) || normalizedFixedHeight <= 0) {
    throw new Error("La hauteur fixe doit être un nombre positif.");
  }

  if (!Array.isArray(widths) || widths.length === 0) {
    throw new Error("Au moins une largeur panneau est requise.");
  }

  const currentSettings = await prisma.panneauSettings.findUnique({ where: { id: "default" } });
  const nextSaleActive =
    typeof isSaleActive === "boolean" ? isSaleActive : currentSettings?.isSaleActive === true;

  const normalizedWidths = widths.map((width, index) => {
    const widthCm = Math.round(Number(width.widthCm));
    const price = Number(width.price);
    const salePrice = normalizeSalePrice(width.salePrice);

    if (!Number.isFinite(widthCm) || widthCm <= 0) {
      throw new Error(`Largeur invalide à la ligne ${index + 1}.`);
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Prix invalide pour la largeur ${widthCm} cm.`);
    }

    return {
      widthCm,
      price,
      salePrice,
      label: cmToPanneauLabel(widthCm),
    };
  });

  const uniqueWidths = new Set(normalizedWidths.map((width) => width.widthCm));
  if (uniqueWidths.size !== normalizedWidths.length) {
    throw new Error("Chaque largeur panneau doit être unique.");
  }

  validateSalePrices(normalizedWidths, nextSaleActive);

  await prisma.$transaction(async (tx) => {
    await tx.panneauSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        fixedHeightCm: normalizedFixedHeight,
        isSaleActive: nextSaleActive,
        updatedBy,
        lastUpdated: new Date(),
      },
      update: {
        fixedHeightCm: normalizedFixedHeight,
        isSaleActive: nextSaleActive,
        updatedBy,
        lastUpdated: new Date(),
      },
    });

    const incomingWidthCms = normalizedWidths.map((width) => width.widthCm);

    await tx.panneauWidth.deleteMany({
      where: {
        widthCm: {
          notIn: incomingWidthCms,
        },
      },
    });

    for (let index = 0; index < normalizedWidths.length; index += 1) {
      const width = normalizedWidths[index];

      await tx.panneauWidth.upsert({
        where: { widthCm: width.widthCm },
        create: {
          widthCm: width.widthCm,
          price: width.price,
          salePrice: width.salePrice,
          label: width.label,
          sortOrder: index,
          isActive: true,
        },
        update: {
          price: width.price,
          salePrice: width.salePrice,
          label: width.label,
          sortOrder: index,
          isActive: true,
        },
      });
    }
  });

  await syncLegacyPanneauPrices(normalizedWidths);
  cachedConfig = null;

  return getPanneauConfig();
}

export async function updatePanneauFixedHeight(fixedHeightCm: number, updatedBy: string) {
  await ensurePanneauConfigInitialized();

  const normalizedFixedHeight = Math.round(Number(fixedHeightCm));
  if (!Number.isFinite(normalizedFixedHeight) || normalizedFixedHeight <= 0) {
    throw new Error("La hauteur fixe doit être un nombre positif.");
  }

  await prisma.panneauSettings.update({
    where: { id: "default" },
    data: {
      fixedHeightCm: normalizedFixedHeight,
      updatedBy,
      lastUpdated: new Date(),
    },
  });

  cachedConfig = null;
  return getPanneauConfig();
}

export async function upsertPanneauWidth(
  input: { widthCm: number; price: number; previousWidthCm?: number },
  updatedBy: string
) {
  await ensurePanneauConfigInitialized();

  const widthCm = Math.round(Number(input.widthCm));
  const price = Number(input.price);
  const previousWidthCm =
    typeof input.previousWidthCm === "number" ? Math.round(input.previousWidthCm) : null;

  if (!Number.isFinite(widthCm) || widthCm <= 0) {
    throw new Error("Largeur invalide.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Prix invalide.");
  }

  const label = cmToPanneauLabel(widthCm);
  const existingTarget = await prisma.panneauWidth.findUnique({ where: { widthCm } });

  if (previousWidthCm !== null && previousWidthCm !== widthCm) {
    const previous = await prisma.panneauWidth.findUnique({ where: { widthCm: previousWidthCm } });
    if (!previous) {
      throw new Error(`Largeur panneau ${previousWidthCm} cm introuvable.`);
    }

    if (existingTarget && existingTarget.widthCm !== previousWidthCm) {
      throw new Error("Cette largeur existe déjà.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.panneauWidth.delete({ where: { widthCm: previousWidthCm } });
      await tx.panneauWidth.create({
        data: {
          widthCm,
          price,
          salePrice: previous.salePrice,
          label,
          sortOrder: previous.sortOrder,
          isActive: true,
        },
      });
      await tx.panneauSettings.update({
        where: { id: "default" },
        data: {
          updatedBy,
          lastUpdated: new Date(),
        },
      });
    });
  } else if (existingTarget) {
    await prisma.$transaction(async (tx) => {
      await tx.panneauWidth.update({
        where: { widthCm },
        data: {
          price,
          label,
          isActive: true,
        },
      });
      await tx.panneauSettings.update({
        where: { id: "default" },
        data: {
          updatedBy,
          lastUpdated: new Date(),
        },
      });
    });
  } else {
    const maxSort = await prisma.panneauWidth.aggregate({ _max: { sortOrder: true } });
    await prisma.$transaction(async (tx) => {
      await tx.panneauWidth.create({
        data: {
          widthCm,
          price,
          salePrice: null,
          label,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          isActive: true,
        },
      });
      await tx.panneauSettings.update({
        where: { id: "default" },
        data: {
          updatedBy,
          lastUpdated: new Date(),
        },
      });
    });
  }

  await syncLegacyPanneauPrices([{ widthCm, price, salePrice: null, label }]);
  cachedConfig = null;
  return getPanneauConfig();
}

export async function deletePanneauWidth(widthCm: number, updatedBy: string) {
  await ensurePanneauConfigInitialized();

  const normalizedWidth = Math.round(Number(widthCm));
  if (!Number.isFinite(normalizedWidth) || normalizedWidth <= 0) {
    throw new Error("Largeur invalide.");
  }

  const activeCount = await prisma.panneauWidth.count({ where: { isActive: true } });
  if (activeCount <= 1) {
    throw new Error("Au moins une largeur panneau est requise.");
  }

  const existing = await prisma.panneauWidth.findUnique({ where: { widthCm: normalizedWidth } });
  if (!existing) {
    throw new Error(`Largeur panneau ${normalizedWidth} cm introuvable.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.panneauWidth.delete({ where: { widthCm: normalizedWidth } });
    await tx.panneauSettings.update({
      where: { id: "default" },
      data: {
        updatedBy,
        lastUpdated: new Date(),
      },
    });
  });

  cachedConfig = null;
  return getPanneauConfig();
}

export async function refreshPanneauConfigCache() {
  cachedConfig = null;
  return getPanneauConfig();
}
