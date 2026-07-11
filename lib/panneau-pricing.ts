import type { PanneauConfig, PanneauWidthConfig } from "./panneau-types";
import {
  DEFAULT_PANNEAU_PRICE_100CM,
  DEFAULT_PANNEAU_PRICE_130CM,
  getEffectivePanneauWidthPrice,
  getPanneauWidthDisplayLabel,
  PANNEAU_FIXED_HEIGHT,
  PANNEAU_WIDTH_100CM,
  PANNEAU_WIDTH_130CM,
  defaultPanneauConfig,
} from "./panneau-types";

export {
  DEFAULT_PANNEAU_PRICE_100CM,
  DEFAULT_PANNEAU_PRICE_130CM,
  PANNEAU_FIXED_HEIGHT,
  PANNEAU_WIDTH_100CM,
  PANNEAU_WIDTH_130CM,
  defaultPanneauConfig,
  getEffectivePanneauWidthPrice,
};
export type { PanneauConfig, PanneauWidthConfig };

export interface PanneauPriceSettings {
  panneauPrice100cm: number;
  panneauPrice130cm: number;
}

export const getPanneauPriceForWidth = (width: number, config: PanneauConfig): number => {
  const normalizedWidth = Math.round(Number(width));
  const match = config.widths.find((entry) => entry.widthCm === normalizedWidth);

  if (match) {
    return getEffectivePanneauWidthPrice(match, config.isSaleActive === true);
  }

  if (normalizedWidth === PANNEAU_WIDTH_100CM) {
    return DEFAULT_PANNEAU_PRICE_100CM;
  }

  if (normalizedWidth === PANNEAU_WIDTH_130CM) {
    return DEFAULT_PANNEAU_PRICE_130CM;
  }

  return 0;
};

export const isAllowedPanneauWidth = (width: number, config: PanneauConfig) =>
  config.widths.some((entry) => entry.widthCm === Math.round(Number(width)));

export const formatPanneauWidthOption = (width: PanneauWidthConfig) => {
  const label = getPanneauWidthDisplayLabel(width);
  return `${label} (${width.widthCm} cm)`;
};
