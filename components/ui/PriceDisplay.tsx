import { getEffectivePricePerM2, isSaleDisplayed, type PriceSettings } from "../../lib/pricing";

interface PriceDisplayProps extends PriceSettings {
  suffix?: string;
  className?: string;
  listClassName?: string;
  saleClassName?: string;
  inline?: boolean;
}

export default function PriceDisplay({
  pricePerM2,
  salePricePerM2 = null,
  isSaleActive = false,
  suffix = " TND/m²",
  className = "",
  listClassName = "text-sm text-gray-500 line-through dark:text-gray-400",
  saleClassName = "text-lg font-bold text-green-600 dark:text-green-400",
  inline = false,
}: PriceDisplayProps) {
  const settings = { pricePerM2, salePricePerM2, isSaleActive };
  const onSale = isSaleDisplayed(settings);
  const effectivePrice = getEffectivePricePerM2(settings);
  const regularClassName = inline
    ? `font-semibold text-gray-900 dark:text-white ${className}`
    : `text-gray-900 dark:text-white ${className || "text-lg font-bold"}`;

  if (!onSale) {
    if (inline) {
      return (
        <span className={regularClassName}>
          {pricePerM2.toFixed(2)}
          {suffix}
        </span>
      );
    }

    return (
      <p className={regularClassName}>
        {pricePerM2.toFixed(2)}
        {suffix}
      </p>
    );
  }

  if (inline) {
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-2 ${className}`}>
        <span className={listClassName}>
          {pricePerM2.toFixed(2)}
          {suffix}
        </span>
        <span className={saleClassName}>
          {effectivePrice.toFixed(2)}
          {suffix}
        </span>
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className={listClassName}>
        {pricePerM2.toFixed(2)}
        {suffix}
      </span>
      <span className={saleClassName}>
        {effectivePrice.toFixed(2)}
        {suffix}
      </span>
    </div>
  );
}
