import React, { createContext, useContext, useState, useEffect } from "react";
// Removed pricing import - using global price instead

export interface CartItem {
  id: string;
  curtainTypeId: string;
  curtainTypeName: string;
  width: number;
  height: number;
  calculation: { total: number; pricePerM2: number; area: number };
  addedAt: Date;
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  wantsInstallation: boolean;
  addItem: (item: Omit<CartItem, "id" | "addedAt">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setWantsInstallation: (wants: boolean) => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wantsInstallation, setWantsInstallation] = useState(true); // Default to true

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("rideaux-bambou-cart");
    const savedInstallation = localStorage.getItem("rideaux-bambou-installation");

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
        console.error("Error loading cart from localStorage:", error);
      }
    }

    if (savedInstallation) {
      try {
        setWantsInstallation(JSON.parse(savedInstallation));
      } catch (error) {
        console.error("Error loading installation preference from localStorage:", error);
      }
    }

    setIsLoading(false);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem("rideaux-bambou-cart", JSON.stringify(items));
  }, [items]);

  // Save installation preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("rideaux-bambou-installation", JSON.stringify(wantsInstallation));
  }, [wantsInstallation]);

  const addItem = (item: Omit<CartItem, "id" | "addedAt">) => {
    const newItem: CartItem = {
      ...item,
      id: `${item.curtainTypeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date(),
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.calculation.total, 0);
  };

  const getItemCount = () => {
    return items.length;
  };

  const handleSetWantsInstallation = (wants: boolean) => {
    setWantsInstallation(wants);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        wantsInstallation,
        addItem,
        removeItem,
        clearCart,
        setWantsInstallation: handleSetWantsInstallation,
        getTotalPrice,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
