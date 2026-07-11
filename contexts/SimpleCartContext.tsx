import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { computeCurtainPrice } from "../lib/order-pricing";
import type { PanneauConfig } from "../lib/panneau-types";
import { defaultPanneauConfig } from "../lib/panneau-pricing";
import { subscribeToPriceSettingsUpdates, type PriceSettingsSyncPayload } from "../lib/price-sync";

export interface SimpleCartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  width: number; // in cm
  height: number; // in cm
  curtainType: "panneau" | "store";
  calculation: {
    area: number; // in m²
    pricePerM2: number;
    total: number;
  };
  addedAt: Date;
}

interface SimpleCartContextType {
  items: SimpleCartItem[];
  isLoading: boolean;
  pricesLoaded: boolean;
  storePriceSettings: {
    pricePerM2: number;
    salePricePerM2?: number | null;
    isSaleActive?: boolean;
    effectivePricePerM2: number;
  };
  panneauConfig: PanneauConfig;
  addItem: (item: Omit<SimpleCartItem, "id" | "addedAt" | "calculation">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  getItemCount: () => number;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  calculatePrice: (
    width: number,
    height: number,
    curtainType?: "panneau" | "store"
  ) => { area: number; pricePerM2: number; total: number };
  refreshPrices: () => Promise<void>;
}

const SimpleCartContext = createContext<SimpleCartContextType | undefined>(undefined);

const defaultStorePriceSettings = {
  pricePerM2: 77,
  salePricePerM2: null as number | null,
  isSaleActive: false,
  effectivePricePerM2: 77,
};

const defaultPanneauConfigState = defaultPanneauConfig();

export function SimpleCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SimpleCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [storePriceSettings, setStorePriceSettings] = useState(defaultStorePriceSettings);
  const [panneauConfig, setPanneauConfig] = useState<PanneauConfig>(defaultPanneauConfigState);

  const calculatePrice = useCallback(
    (width: number, height: number, curtainType: "panneau" | "store" = "store") =>
      computeCurtainPrice(width, height, curtainType, storePriceSettings, panneauConfig),
    [storePriceSettings, panneauConfig]
  );

  const applySyncedPrices = useCallback((payload: PriceSettingsSyncPayload) => {
    if (!payload.storePrice && !payload.panneauConfig) {
      return false;
    }

    setStorePriceSettings((previousStore) => {
      const nextStore = payload.storePrice ?? previousStore;

      setPanneauConfig((previousPanneau) => {
        const nextPanneau = payload.panneauConfig ?? previousPanneau;

        setItems((previousItems) =>
          previousItems.map((item) => ({
            ...item,
            calculation: computeCurtainPrice(
              item.width,
              item.height,
              item.curtainType,
              nextStore,
              nextPanneau
            ),
          }))
        );

        return nextPanneau;
      });

      return nextStore;
    });

    setPricesLoaded(true);
    return true;
  }, []);

  const refreshPrices = useCallback(async () => {
    try {
      const [priceResponse, panneauResponse] = await Promise.all([
        fetch("/api/price"),
        fetch("/api/panneau-config"),
      ]);
      const data = await priceResponse.json();
      const panneauData = await panneauResponse.json();

      if (!data.success || !data.data) {
        return;
      }

      const listPrice = data.data.pricePerM2 ?? 77;
      const effectivePrice = data.data.effectivePricePerM2 ?? listPrice;
      const nextStorePriceSettings = {
        pricePerM2: listPrice,
        salePricePerM2: data.data.salePricePerM2 ?? null,
        isSaleActive: data.data.isSaleActive === true,
        effectivePricePerM2: effectivePrice,
      };
      const nextPanneauConfig: PanneauConfig =
        panneauData.success && panneauData.data ? panneauData.data : defaultPanneauConfigState;

      setStorePriceSettings(nextStorePriceSettings);
      setPanneauConfig(nextPanneauConfig);
      setPricesLoaded(true);

      setItems((previousItems) =>
        previousItems.map((item) => ({
          ...item,
          calculation: computeCurtainPrice(
            item.width,
            item.height,
            item.curtainType,
            nextStorePriceSettings,
            nextPanneauConfig
          ),
        }))
      );
    } catch (loadError) {
      console.error("Error loading price settings:", loadError);
    }
  }, []);

  useEffect(() => {
    const savedCart = localStorage.getItem("simple-cart");

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        const cartWithDates = parsedCart.map((item: SimpleCartItem) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }));
        setItems(cartWithDates);
      } catch (error) {
        console.error("Error loading simple cart from localStorage:", error);
      }
    }

    void refreshPrices().finally(() => {
      setIsLoading(false);
    });
  }, [refreshPrices]);

  useEffect(() => subscribeToPriceSettingsUpdates((payload) => {
    if (!applySyncedPrices(payload)) {
      void refreshPrices();
    }
  }), [applySyncedPrices, refreshPrices]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    localStorage.setItem("simple-cart", JSON.stringify(items));
  }, [items, isLoading]);

  const addItem = (item: Omit<SimpleCartItem, "id" | "addedAt" | "calculation">) => {
    const calculation = calculatePrice(item.width, item.height, item.curtainType);

    const existingItem = items.find(
      (existing) =>
        existing.productId === item.productId &&
        existing.width === item.width &&
        existing.height === item.height &&
        existing.curtainType === item.curtainType
    );

    if (existingItem) {
      setItems((prev) =>
        prev.map((existing) =>
          existing.id === existingItem.id
            ? { ...existing, quantity: existing.quantity + item.quantity }
            : existing
        )
      );
      return;
    }

    const newItem: SimpleCartItem = {
      ...item,
      calculation,
      id: `${item.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date(),
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const clearCart = () => {
    setItems([]);
  };

  const getItemCount = () => items.length;

  const getTotalItems = () => items.reduce((total, item) => total + item.quantity, 0);

  const getTotalPrice = () =>
    items.reduce((total, item) => total + item.calculation.total * item.quantity, 0);

  const contextValue = useMemo(
    () => ({
      items,
      isLoading,
      pricesLoaded,
      storePriceSettings,
      panneauConfig,
      addItem,
      removeItem,
      clearCart,
      updateQuantity,
      getItemCount,
      getTotalItems,
      getTotalPrice,
      calculatePrice,
      refreshPrices,
    }),
    [
      items,
      isLoading,
      pricesLoaded,
      storePriceSettings,
      panneauConfig,
      calculatePrice,
      refreshPrices,
    ]
  );

  return (
    <SimpleCartContext.Provider value={contextValue}>{children}</SimpleCartContext.Provider>
  );
}

export function useSimpleCart() {
  const context = useContext(SimpleCartContext);
  if (context === undefined) {
    throw new Error("useSimpleCart must be used within a SimpleCartProvider");
  }
  return context;
}
