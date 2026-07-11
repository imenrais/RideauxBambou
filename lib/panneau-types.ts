export const PANNEAU_WIDTH_100CM = 100;
export const PANNEAU_WIDTH_130CM = 130;
export const PANNEAU_FIXED_HEIGHT = 220;
export const DEFAULT_PANNEAU_PRICE_100CM = 160;
export const DEFAULT_PANNEAU_PRICE_130CM = 180;

export interface PanneauWidthConfig {
  id: string;
  widthCm: number;
  label: string | null;
  price: number;
  salePrice?: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface PanneauConfig {
  fixedHeightCm: number;
  isSaleActive?: boolean;
  widths: PanneauWidthConfig[];
  lastUpdated?: string;
}

export interface PanneauWidthInput {
  widthCm: number;
  price: number;
  label?: string | null;
  salePrice?: number | null;
}

export const cmToPanneauLabel = (widthCm: number): string => {
  const cm = Math.round(Number(widthCm));

  if (!Number.isFinite(cm) || cm <= 0) {
    return "";
  }

  if (cm < 100) {
    return `${cm} cm`;
  }

  const meters = Math.floor(cm / 100);
  const remainder = cm % 100;

  if (remainder === 0) {
    return `${meters}m`;
  }

  return `${meters}m${remainder}`;
};

export const formatPanneauWidthLabel = (widthCm: number, _customLabel?: string | null) =>
  cmToPanneauLabel(widthCm);

export const formatPanneauCardLabel = (widthCm: number): string => {
  const measurement = cmToPanneauLabel(widthCm);
  return measurement ? `Panneau ${measurement}` : "Panneau";
};

export const getPanneauWidthDisplayLabel = (width: Pick<PanneauWidthConfig, "widthCm" | "label">) =>
  cmToPanneauLabel(width.widthCm);

export const getEffectivePanneauWidthPrice = (
  width: Pick<PanneauWidthConfig, "price" | "salePrice">,
  isSaleActive: boolean
) => {
  const listPrice = width.price;
  const salePrice = width.salePrice;

  if (
    isSaleActive &&
    typeof salePrice === "number" &&
    salePrice > 0 &&
    salePrice < listPrice
  ) {
    return salePrice;
  }

  return listPrice;
};

export const defaultPanneauConfig = (): PanneauConfig => ({
  fixedHeightCm: PANNEAU_FIXED_HEIGHT,
  isSaleActive: false,
  widths: [
    {
      id: "default-100",
      widthCm: PANNEAU_WIDTH_100CM,
      label: "1m",
      price: DEFAULT_PANNEAU_PRICE_100CM,
      salePrice: null,
      sortOrder: 0,
      isActive: true,
    },
    {
      id: "default-130",
      widthCm: PANNEAU_WIDTH_130CM,
      label: "1m30",
      price: DEFAULT_PANNEAU_PRICE_130CM,
      salePrice: null,
      sortOrder: 1,
      isActive: true,
    },
  ],
});
