export interface PriceSettings {
  pricePerM2: number;
  salePricePerM2?: number | null;
  isSaleActive?: boolean;
}

export const getEffectivePricePerM2 = (settings: PriceSettings): number => {
  const listPrice = settings.pricePerM2;
  const salePrice = settings.salePricePerM2;

  if (
    settings.isSaleActive &&
    typeof salePrice === "number" &&
    salePrice > 0 &&
    salePrice < listPrice
  ) {
    return salePrice;
  }

  return listPrice;
};

export const isSaleDisplayed = (settings: PriceSettings): boolean =>
  getEffectivePricePerM2(settings) < settings.pricePerM2;
