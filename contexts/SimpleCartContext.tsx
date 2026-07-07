import React, { createContext, useContext, useState, useEffect } from "react";

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
  addItem: (item: Omit<SimpleCartItem, "id" | "addedAt" | "calculation">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  getItemCount: () => number;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  calculatePrice: (
    width: number,
    height: number
  ) => { area: number; pricePerM2: number; total: number };
}

const SimpleCartContext = createContext<SimpleCartContextType | undefined>(undefined);

export function SimpleCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SimpleCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate price for given dimensions
  const calculatePrice = (width: number, height: number) => {
    const pricePerM2 = 77;
    const adjustedHeight = height + 20;
    const area = (width * adjustedHeight) / 10000; // Convert cm² to m² after +20cm
    const installationAddon = width >= 100 ? 8.6 : 4.3;
    const total = Math.trunc(area * pricePerM2 + installationAddon);

    return {
      area: Math.round(area * 100) / 100, // Round to 2 decimal places
      pricePerM2,
      total, // Remove decimal values after comma
    };
  };

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("simple-cart");

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        // Convert addedAt strings back to Date objects
        const cartWithDates = parsedCart.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }));
        setItems(cartWithDates);
      } catch (error) {
        console.error("Error loading simple cart from localStorage:", error);
      }
    }

    setIsLoading(false);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem("simple-cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<SimpleCartItem, "id" | "addedAt" | "calculation">) => {
    const calculation = calculatePrice(item.width, item.height);

    const existingItem = items.find(
      (existing) =>
        existing.productId === item.productId &&
        existing.width === item.width &&
        existing.height === item.height &&
        existing.curtainType === item.curtainType
    );

    if (existingItem) {
      // Update quantity if item already exists
      setItems((prev) =>
        prev.map((existing) =>
          existing.id === existingItem.id
            ? { ...existing, quantity: existing.quantity + item.quantity }
            : existing
        )
      );
    } else {
      // Add new item
      const newItem: SimpleCartItem = {
        ...item,
        calculation,
        id: `${item.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        addedAt: new Date(),
      };
      setItems((prev) => [...prev, newItem]);
    }
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

  const getItemCount = () => {
    return items.length;
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.calculation.total * item.quantity, 0);
  };

  return (
    <SimpleCartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        clearCart,
        updateQuantity,
        getItemCount,
        getTotalItems,
        getTotalPrice,
        calculatePrice,
      }}
    >
      {children}
    </SimpleCartContext.Provider>
  );
}

export function useSimpleCart() {
  const context = useContext(SimpleCartContext);
  if (context === undefined) {
    throw new Error("useSimpleCart must be used within a SimpleCartProvider");
  }
  return context;
}
