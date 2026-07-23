import type { PanneauConfig } from "./panneau-types";
import { getPanneauPriceForWidth } from "./panneau-pricing";
import { distributeStorePanelWidths } from "./store-panel-count";

const STORE_MIN_TOTAL = 77;
const STORE_ADDON_UNDER_1M = 4.3;
const STORE_ADDON_FROM_1M = 8.6;

export interface StorePriceSettings {
  effectivePricePerM2: number;
}

const storeWidthAddon = (widthCm: number): number =>
  widthCm >= 100 ? STORE_ADDON_FROM_1M : STORE_ADDON_UNDER_1M;

/**
 * Store price:
 * - Surface: ((hauteur + 20) × largeur / 10000) × prix/m²  (always the form fields)
 * - Addon: 4,3 DT if curtain largeur < 1 m, else 8,6 DT
 *   · 1 curtain → addon from the opening largeur once
 *   · spit → addon for each curtain width (e.g. 160+160+160 → 8,6 × 3)
 * - Truncate decimals (no cents)
 */
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
  const panelWidths = distributeStorePanelWidths(width);
  const installationAddon = panelWidths.reduce(
    (sum, panelWidthCm) => sum + storeWidthAddon(panelWidthCm),
    0
  );
  const total = Math.max(
    STORE_MIN_TOTAL,
    Math.trunc(area * pricePerM2 + installationAddon)
  );

  return {
    area: Math.round(area * 100) / 100,
    pricePerM2,
    total,
  };
};

/**
 * Store line total is already the full opening (surface + per-curtain addons).
 * Cart quantity is manufacturing panel count — do not multiply again.
 */
export const getCurtainLineTotal = (
  curtainType: "panneau" | "store",
  unitTotal: number,
  quantity: number
): number => {
  if (curtainType === "store") {
    return Math.trunc(unitTotal);
  }
  return Math.trunc(unitTotal * quantity);
};
