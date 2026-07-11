import type { PanneauConfig } from "./panneau-types";
import { getEffectivePricePerM2 } from "./pricing";

export const PRICE_SETTINGS_SYNC_EVENT = "rideaux-bamboux:price-settings-updated";

export type PublicStorePriceSettings = {
  pricePerM2: number;
  salePricePerM2: number | null;
  isSaleActive: boolean;
  effectivePricePerM2: number;
};

export type PriceSettingsSyncPayload = {
  updatedAt: number;
  storePrice?: PublicStorePriceSettings;
  panneauConfig?: PanneauConfig;
};

export function buildStorePriceSyncPayload(priceData: {
  pricePerM2: number;
  salePricePerM2?: number | null;
  isSaleActive?: boolean;
  effectivePricePerM2?: number;
}): PublicStorePriceSettings {
  const listPrice = priceData.pricePerM2;
  const settings = {
    pricePerM2: listPrice,
    salePricePerM2: priceData.salePricePerM2 ?? null,
    isSaleActive: priceData.isSaleActive === true,
  };

  return {
    ...settings,
    effectivePricePerM2: priceData.effectivePricePerM2 ?? getEffectivePricePerM2(settings),
  };
}

const readPayloadFromStorage = (): PriceSettingsSyncPayload => {
  const raw = window.localStorage.getItem(PRICE_SETTINGS_SYNC_EVENT);
  if (!raw) {
    return { updatedAt: Date.now() };
  }

  try {
    return JSON.parse(raw) as PriceSettingsSyncPayload;
  } catch {
    return { updatedAt: Date.now() };
  }
};

export const notifyPriceSettingsUpdated = (
  payload: Omit<PriceSettingsSyncPayload, "updatedAt"> = {}
) => {
  if (typeof window === "undefined") {
    return;
  }

  const fullPayload: PriceSettingsSyncPayload = {
    updatedAt: Date.now(),
    ...payload,
  };

  window.localStorage.setItem(PRICE_SETTINGS_SYNC_EVENT, JSON.stringify(fullPayload));
  window.dispatchEvent(
    new CustomEvent<PriceSettingsSyncPayload>(PRICE_SETTINGS_SYNC_EVENT, {
      detail: fullPayload,
    })
  );
};

export const subscribeToPriceSettingsUpdates = (
  onUpdate: (payload: PriceSettingsSyncPayload) => void
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PRICE_SETTINGS_SYNC_EVENT && event.newValue) {
      try {
        onUpdate(JSON.parse(event.newValue) as PriceSettingsSyncPayload);
      } catch {
        onUpdate(readPayloadFromStorage());
      }
    }
  };

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<PriceSettingsSyncPayload>).detail;
    onUpdate(detail ?? readPayloadFromStorage());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PRICE_SETTINGS_SYNC_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PRICE_SETTINGS_SYNC_EVENT, handleCustom);
  };
};
