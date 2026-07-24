/** Max width (cm) covered by a single store curtain panel. */
export const STORE_PANEL_WIDTH_CM = 210;

/** Hard cap to prevent DoS via huge widths creating giant panel arrays. */
export const MAX_STORE_PANELS = 10;
export const MAX_STORE_WIDTH_CM = STORE_PANEL_WIDTH_CM * MAX_STORE_PANELS;

/**
 * How many store curtains are needed for a given opening width.
 * 0–210 → 1, 211–420 → 2, 421–630 → 3, … (capped at MAX_STORE_PANELS)
 */
export const getStorePanelCountFromWidth = (widthCm: number): number => {
  if (!Number.isFinite(widthCm) || widthCm <= 0) {
    return 1;
  }
  return Math.min(MAX_STORE_PANELS, Math.max(1, Math.ceil(widthCm / STORE_PANEL_WIDTH_CM)));
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
  const cappedWidth = Math.min(MAX_STORE_WIDTH_CM, Math.max(1, widthCm));
  const count = getStorePanelCountFromWidth(cappedWidth);
  if (count === 1) {
    return [Math.round(cappedWidth)];
  }

  const totalCm = Math.round(cappedWidth);
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
