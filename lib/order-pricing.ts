import type { PanneauConfig } from "./panneau-types";
import { getPanneauPriceForWidth } from "./panneau-pricing";

const STORE_MIN_TOTAL = 77;

export interface StorePriceSettings {
  effectivePricePerM2: number;
}

export const computeCurtainPrice = (
  width: number,
  height: number,
  curtainType: "panneau" | "store",
  storePrice: StorePriceSettings,
  panneauConfig: PanneauConfig
) => {
  if (curtainType === "panneau") {
    const total = getPanneauPriceForWidth(width, panneauConfig);
    const area = (width * panneauConfig.fixedHeightCm) / 10000;

    return {
      area: Math.round(area * 100) / 100,
      pricePerM2: 0,
      total,
    };
  }

  const pricePerM2 = storePrice.effectivePricePerM2;
  const adjustedHeight = height + 20;
  const area = (width * adjustedHeight) / 10000;
  const installationAddon = width >= 100 ? 8.6 : 4.3;
  const total = Math.max(STORE_MIN_TOTAL, Math.trunc(area * pricePerM2 + installationAddon));

  return {
    area: Math.round(area * 100) / 100,
    pricePerM2,
    total,
  };
};
