export const PRODUCT_AVAILABILITY_SYNC_EVENT = "rideaux-bamboux:products-updated";

export const OUT_OF_STOCK_CLIENT_MESSAGE = "Rupture de stock pour le moment";

export type ProductAvailabilitySyncPayload = {
  updatedAt: number;
};

const readPayloadFromStorage = (): ProductAvailabilitySyncPayload => {
  const raw = window.localStorage.getItem(PRODUCT_AVAILABILITY_SYNC_EVENT);
  if (!raw) {
    return { updatedAt: Date.now() };
  }

  try {
    return JSON.parse(raw) as ProductAvailabilitySyncPayload;
  } catch {
    return { updatedAt: Date.now() };
  }
};

export const notifyProductsUpdated = () => {
  if (typeof window === "undefined") {
    return;
  }

  const payload: ProductAvailabilitySyncPayload = { updatedAt: Date.now() };

  window.localStorage.setItem(PRODUCT_AVAILABILITY_SYNC_EVENT, JSON.stringify(payload));
  window.dispatchEvent(
    new CustomEvent<ProductAvailabilitySyncPayload>(PRODUCT_AVAILABILITY_SYNC_EVENT, {
      detail: payload,
    })
  );
};

export const subscribeToProductUpdates = (onUpdate: (payload: ProductAvailabilitySyncPayload) => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PRODUCT_AVAILABILITY_SYNC_EVENT && event.newValue) {
      try {
        onUpdate(JSON.parse(event.newValue) as ProductAvailabilitySyncPayload);
      } catch {
        onUpdate(readPayloadFromStorage());
      }
    }
  };

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<ProductAvailabilitySyncPayload>).detail;
    onUpdate(detail ?? readPayloadFromStorage());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PRODUCT_AVAILABILITY_SYNC_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PRODUCT_AVAILABILITY_SYNC_EVENT, handleCustom);
  };
};
