import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";

import { subscribeToProductUpdates } from "./product-availability-sync";

export const PRODUCTS_QUERY_KEY = ["products"] as const;

export type PublicProduct = {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
  supportsPanneau: boolean;
  createdAt?: string | Date;
};

const normalizeAvailability = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    if (normalized === "true" || normalized === "1") {
      return true;
    }
  }

  if (typeof value === "number") {
    if (value === 0) {
      return false;
    }
    if (value === 1) {
      return true;
    }
  }

  return true;
};

export async function fetchPublicProducts(): Promise<PublicProduct[]> {
  const response = await fetch("/api/products");
  const data = await response.json();

  if (!data.success || !Array.isArray(data.data)) {
    return [];
  }

  return (data.data as PublicProduct[]).map((product) => ({
    ...product,
    isAvailable: normalizeAvailability(product.isAvailable),
  }));
}

export function useProductsSubscription() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToProductUpdates(() => {
        void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      }),
    [queryClient]
  );
}

export function usePublicProductsQuery<TData = PublicProduct[]>(
  options?: Omit<UseQueryOptions<PublicProduct[], Error, TData>, "queryKey" | "queryFn">
) {
  useProductsSubscription();

  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchPublicProducts,
    ...options,
  });
}
