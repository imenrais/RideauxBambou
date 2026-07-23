/** Max width (cm) covered by a single store curtain panel. */
export const STORE_PANEL_WIDTH_CM = 210;

/**
 * How many store curtains are needed for a given opening width.
 * 0–210 → 1, 211–420 → 2, 421–630 → 3, …
 */
export const getStorePanelCountFromWidth = (widthCm: number): number => {
  if (!Number.isFinite(widthCm) || widthCm <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(widthCm / STORE_PANEL_WIDTH_CM));
};

export interface StorePanelMeasurement {
  index: number;
  widthCm: number;
  heightCm: number;
}

/**
 * Split an opening evenly across panels (integer cm; leftover on the last panel).
 * Surface pricing uses the full opening; width addons use each panel width.
 */
export const distributeStorePanelWidths = (widthCm: number): number[] => {
  const count = getStorePanelCountFromWidth(widthCm);
  if (count === 1) {
    return [Math.round(widthCm)];
  }

  const totalCm = Math.round(widthCm);
  const base = Math.floor(totalCm / count);
  const remainder = totalCm - base * count;

  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base
  );
};

/** Measurements shown to the client for each store curtain in the order. */
export const getStorePanelMeasurements = (
  widthCm: number,
  heightCm: number
): StorePanelMeasurement[] => {
  if (!Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(heightCm) || heightCm <= 0) {
    return [];
  }

  return distributeStorePanelWidths(widthCm).map((panelWidthCm, index) => ({
    index: index + 1,
    widthCm: panelWidthCm,
    heightCm: Math.round(heightCm),
  }));
};

export const formatStorePanelDimension = (widthCm: number, heightCm: number) =>
  `${widthCm} × ${heightCm} cm`;
