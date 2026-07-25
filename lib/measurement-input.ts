/** French decimal comma for cm measurements (e.g. 120,5). */

export const sanitizeMeasurementInput = (raw: string): string => {
  // Allow digits and a single comma; convert typed "." to ",".
  const cleaned = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  let hasComma = false;
  let result = "";
  for (const char of cleaned) {
    if (char === ",") {
      if (hasComma) continue;
      hasComma = true;
      result += char;
      continue;
    }
    result += char;
  }
  return result;
};

export const parseMeasurement = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed.replace(",", "."));
};

export const formatMeasurement = (value: number): string =>
  String(value).replace(".", ",");
