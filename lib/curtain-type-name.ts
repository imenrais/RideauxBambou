export function getCurtainTypeLabel(curtainType: string): string {
  return curtainType === "panneau" ? "Panneau" : "Store";
}

export function formatCurtainTypeName(productName: string, curtainType: string): string {
  return `${productName.trim()} - ${getCurtainTypeLabel(curtainType)}`;
}

export function normalizeCurtainTypeName(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "N/A";
  }

  const trimmed = value.trim();
  const parenMatch = trimmed.match(/^(.+?)\s*\((Panneau|Store)\)\s*$/i);
  if (parenMatch) {
    const [, name, type] = parenMatch;
    const normalizedType = type.toLowerCase() === "panneau" ? "Panneau" : "Store";
    return `${name.trim()} - ${normalizedType}`;
  }

  return trimmed;
}
