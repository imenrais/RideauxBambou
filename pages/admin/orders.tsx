import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo, useRef } from "react";

import AdminNavigation from "../../components/AdminNavigation";
import BackButton from "../../components/BackButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import PriceDisplay from "../../components/ui/PriceDisplay";
import { adminTableShellClassName } from "../../components/ui/Table";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";
import { escapeHtml } from "../../lib/email-templates";
import { getEmailValidationError, normalizeEmailValue } from "../../lib/email-validation";
import { computeCurtainPrice } from "../../lib/order-pricing";
import {
  formFieldClass,
  formFieldDisabledClass,
  formFieldErrorClass,
  formFieldLabelClass,
  formNumberFieldClass,
  formSelectClass,
  formSelectDisabledClass,
  formTextareaClass,
} from "../../lib/form-field-styles";
import type { PanneauConfig } from "../../lib/panneau-types";
import { defaultPanneauConfig, formatPanneauWidthOption } from "../../lib/panneau-pricing";
import { getPhoneValidationError, normalizePhoneValue } from "../../lib/phone-validation";
import {
  fetchPublicProducts,
  PRODUCTS_QUERY_KEY,
  useProductsSubscription,
} from "../../lib/products-query";
import { subscribeToPriceSettingsUpdates } from "../../lib/price-sync";
import {
  getCitiesForGovernorate,
  GOVERNORATE_CODE_MAP,
  resolveGovernorateName,
  TUNISIAN_GOVERNORATES,
  normalizeGovernorate,
} from "../../lib/tunisia-locations";

interface AdminOrdersProps {
  title: string;
}

interface Product {
  _id: string;
  name: string;
  supportsPanneau?: boolean;
}

type CanonicalOrderStatus = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
type CurtainType = "panneau" | "store";

const STORE_WIDTH_MAX = 210;
const STORE_MIN_TOTAL = 77;

const statusAliases: Record<string, CanonicalOrderStatus> = {
  shipped: "processing",
};

const normalizeStatus = (status?: string): CanonicalOrderStatus => {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (normalized in statusAliases) {
    return statusAliases[normalized];
  }
  if (
    normalized === "pending" ||
    normalized === "confirmed" ||
    normalized === "processing" ||
    normalized === "delivered" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "pending";
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusOptions = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En cours" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En cours",
  delivered: "Livrée",
  cancelled: "Annulée",
  shipped: "En cours",
};

const ADMIN_ORDERS_LIST_QUERY_KEY = ["admin-orders"] as const;
const ADMIN_ORDERS_STATS_QUERY_KEY = ["admin-orders-stats"] as const;

interface OrderStats {
  totalOrders?: number;
  pendingOrders?: number;
  confirmedOrders?: number;
  processingOrders?: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
}

interface AdminOrdersQueryData {
  orders?: any[];
  stats?: OrderStats;
  pagination?: {
    currentPage?: number;
    totalPages?: number;
    totalOrders?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

const statusToStatsKey: Record<CanonicalOrderStatus, keyof OrderStats> = {
  pending: "pendingOrders",
  confirmed: "confirmedOrders",
  processing: "processingOrders",
  delivered: "deliveredOrders",
  cancelled: "cancelledOrders",
};

const updateStatusStats = (stats: OrderStats | undefined, previousStatus: string, nextStatus: string) => {
  const normalizedPrevious = normalizeStatus(previousStatus);
  const normalizedNext = normalizeStatus(nextStatus);
  if (normalizedPrevious === normalizedNext) {
    return stats;
  }

  const nextStats: OrderStats = { ...(stats || {}) };
  const previousKey = statusToStatsKey[normalizedPrevious];
  const nextKey = statusToStatsKey[normalizedNext];

  nextStats[previousKey] = Math.max(0, (nextStats[previousKey] || 0) - 1);
  nextStats[nextKey] = (nextStats[nextKey] || 0) + 1;

  return nextStats;
};

const incrementStatsWithOrder = (stats: OrderStats | undefined, orderStatus: string) => {
  const normalizedStatus = normalizeStatus(orderStatus);
  const nextStats: OrderStats = { ...(stats || {}) };
  const statsKey = statusToStatsKey[normalizedStatus];

  nextStats.totalOrders = (nextStats.totalOrders || 0) + 1;
  nextStats[statsKey] = (nextStats[statsKey] || 0) + 1;

  return nextStats;
};

const parseOrdersListQueryMeta = (queryKey: readonly unknown[]) => {
  if (queryKey[0] !== "admin-orders") {
    return null;
  }

  return {
    selectedStatus: typeof queryKey[1] === "string" ? queryKey[1] : "",
    searchTerm: typeof queryKey[2] === "string" ? queryKey[2] : "",
    orderIdLookup: typeof queryKey[3] === "string" ? queryKey[3] : "",
    currentPage: typeof queryKey[4] === "number" ? queryKey[4] : 1,
  };
};

const shouldIncludeOrderInQuery = (queryKey: readonly unknown[], orderStatus: string) => {
  const meta = parseOrdersListQueryMeta(queryKey);
  if (!meta) {
    return false;
  }
  if (meta.currentPage !== 1 || meta.searchTerm.trim() || meta.orderIdLookup.trim()) {
    return false;
  }
  if (!meta.selectedStatus) {
    return true;
  }
  return normalizeStatus(meta.selectedStatus) === normalizeStatus(orderStatus);
};

const applyOrderStatusUpdate = (
  oldData: AdminOrdersQueryData | undefined,
  orderId: string,
  nextStatus: string,
  updatedOrder?: any
) => {
  if (!oldData?.orders) {
    return oldData;
  }

  let previousStatus: string | null = null;
  const nextOrders = oldData.orders.map((order) => {
    if (order._id !== orderId) {
      return order;
    }
    previousStatus = order.status;
    return {
      ...order,
      ...(updatedOrder || {}),
      status: normalizeStatus(nextStatus),
    };
  });

  if (!previousStatus) {
    return oldData;
  }

  return {
    ...oldData,
    orders: nextOrders,
    stats: updateStatusStats(oldData.stats, previousStatus, nextStatus),
  };
};

const applyOrderCreateUpdate = (
  oldData: AdminOrdersQueryData | undefined,
  createdOrder: any,
  queryKey: readonly unknown[]
) => {
  if (!oldData) {
    return oldData;
  }

  const nextStats = incrementStatsWithOrder(oldData.stats, createdOrder.status);
  const shouldInclude = shouldIncludeOrderInQuery(queryKey, createdOrder.status);
  const existingOrders = Array.isArray(oldData.orders) ? oldData.orders : [];
  const alreadyInList = existingOrders.some((order) => order._id === createdOrder._id);
  const nextOrders =
    shouldInclude && !alreadyInList
      ? [createdOrder, ...existingOrders].slice(0, Math.max(existingOrders.length, 1))
      : existingOrders;

  const previousTotalOrders = oldData.pagination?.totalOrders || 0;
  const pageSize = Math.max(existingOrders.length || 10, 1);
  const nextTotalOrders = previousTotalOrders + 1;

  return {
    ...oldData,
    orders: nextOrders,
    stats: nextStats,
    pagination: oldData.pagination
      ? {
          ...oldData.pagination,
          totalOrders: nextTotalOrders,
          totalPages: Math.max(1, Math.ceil(nextTotalOrders / pageSize)),
        }
      : oldData.pagination,
  };
};

const replaceOrderById = (
  oldData: AdminOrdersQueryData | undefined,
  optimisticOrderId: string,
  serverOrder: any
) => {
  if (!oldData?.orders) {
    return oldData;
  }
  return {
    ...oldData,
    orders: oldData.orders.map((order) => (order._id === optimisticOrderId ? serverOrder : order)),
  };
};

export default function AdminOrders({ title }: AdminOrdersProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [focusOrderLookup, setFocusOrderLookup] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const hasScrolledToFocusedOrder = useRef(false);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [manualOrderError, setManualOrderError] = useState("");
  const [manualStoreWidthError, setManualStoreWidthError] = useState("");
  const [manualEmailError, setManualEmailError] = useState("");
  const [manualPhoneError, setManualPhoneError] = useState("");
  const [hasSelectedManualReferenceByType, setHasSelectedManualReferenceByType] = useState<
    Record<CurtainType, boolean>
  >({
    panneau: false,
    store: false,
  });
  const [manualOrderForm, setManualOrderForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    productId: "",
    curtainType: "panneau" as CurtainType,
    width: "",
    height: "",
    quantity: "1",
    deliveryFee: "",
    installationFee: "11",
    wantsInstallation: null as boolean | null,
    notes: "",
  });
  const { success, error } = useToast();
  const getFocusedOrderClass = (orderId: string) =>
    orderId === focusedOrderId
      ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-900/25"
      : "";

  const { data: productsData, isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchPublicProducts,
  });

  useProductsSubscription();

  const { data: installationFeeData } = useQuery({
    queryKey: ["admin-installation-fee"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/installation-fee");
        const data = await response.json();
        return data.success ? data.data : { fee: 11 };
      } catch {
        return { fee: 11 };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: deliveryFees = [] } = useQuery({
    queryKey: ["admin-orders-delivery-fees"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/delivery-fees");
        const data = await response.json();
        const fees = data.success ? data.data : [];
        return Array.isArray(fees) ? fees : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: storePriceData } = useQuery({
    queryKey: ["admin-store-price"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/price");
        const data = await response.json();
        return data.success
          ? data.data
          : { pricePerM2: 77, effectivePricePerM2: 77, isSaleActive: false };
      } catch {
        return { pricePerM2: 77, effectivePricePerM2: 77, isSaleActive: false };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: panneauConfigData } = useQuery({
    queryKey: ["admin-panneau-config"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/panneau-config");
        const data = await response.json();
        return data.success ? (data.data as PanneauConfig) : defaultPanneauConfig();
      } catch {
        return defaultPanneauConfig();
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const panneauConfig = panneauConfigData ?? defaultPanneauConfig();
  const storePricePerM2 = storePriceData?.effectivePricePerM2 ?? 77;

  const products = useMemo(() => (Array.isArray(productsData) ? productsData : []), [productsData]);
  const panneauProducts = useMemo(
    () => products.filter((product) => product.supportsPanneau === true),
    [products]
  );
  const panneauWidthValues = useMemo(
    () => new Set(panneauConfig.widths.map((entry) => entry.widthCm)),
    [panneauConfig.widths]
  );
  const selectableManualProducts =
    manualOrderForm.curtainType === "panneau" ? panneauProducts : products;
  const selectedProduct = products.find((product) => product._id === manualOrderForm.productId);
  const selectedProductName = selectedProduct?.name?.trim() || "";
  const hasSelectedManualReferenceForCurrentType =
    hasSelectedManualReferenceByType[manualOrderForm.curtainType];
  const handleManualReferenceChange = (nextProductId: string) => {
    if (!nextProductId && hasSelectedManualReferenceForCurrentType) {
      return;
    }

    setManualOrderForm((prev) => ({ ...prev, productId: nextProductId }));

    if (nextProductId) {
      setHasSelectedManualReferenceByType((prev) => ({
        ...prev,
        [manualOrderForm.curtainType]: true,
      }));
    }
  };
  const citiesForSelectedGovernorate = useMemo(
    () => getCitiesForGovernorate(manualOrderForm.state),
    [manualOrderForm.state]
  );
  const normalizedSelectedState = normalizeGovernorate(manualOrderForm.state);
  const selectedStateCode =
    GOVERNORATE_CODE_MAP[normalizedSelectedState] ||
    (manualOrderForm.state.trim().length === 2 ? manualOrderForm.state.trim().toUpperCase() : "");
  const autoDeliveryFee =
    deliveryFees?.find(
      (fee: any) =>
        normalizeGovernorate(fee.state) === normalizedSelectedState || fee.stateCode === selectedStateCode
    )?.fee || 0;

  const widthValue = Number(manualOrderForm.width);
  const heightValue = Number(manualOrderForm.height);
  const quantityValue = Number(manualOrderForm.quantity);
  const installationFeeValue =
    typeof installationFeeData?.fee === "number" ? installationFeeData.fee : Number(manualOrderForm.installationFee);
  const hasWidth = manualOrderForm.width !== "";
  const hasHeight = manualOrderForm.curtainType === "panneau" || manualOrderForm.height !== "";
  const resolvedHeightValue =
    manualOrderForm.curtainType === "panneau" ? panneauConfig.fixedHeightCm : heightValue;

  const isDimensionValid = hasWidth && hasHeight && widthValue > 0 && resolvedHeightValue > 0;
  const isQuantityValid = quantityValue > 0;
  const isStoreWidthInvalid =
    manualOrderForm.curtainType === "store" &&
    hasWidth &&
    !Number.isNaN(widthValue) &&
    widthValue > STORE_WIDTH_MAX;
  const installationSelected = manualOrderForm.wantsInstallation === true;

  const priceCalculation = useMemo(() => {
    if (!isDimensionValid || isStoreWidthInvalid) {
      return { area: 0, pricePerM2: storePricePerM2, total: 0 };
    }
    if (manualOrderForm.curtainType === "panneau") {
      return computeCurtainPrice(
        widthValue,
        panneauConfig.fixedHeightCm,
        "panneau",
        { effectivePricePerM2: storePricePerM2 },
        panneauConfig
      );
    }
    const adjustedHeight = resolvedHeightValue + 20;
    const area = (widthValue * adjustedHeight) / 10000;
    const installationAddon = widthValue >= 100 ? 8.6 : 4.3;
    return {
      area: Math.round(area * 100) / 100,
      pricePerM2: storePricePerM2,
      total: Math.max(STORE_MIN_TOTAL, Math.trunc(area * storePricePerM2 + installationAddon)),
    };
  }, [
    widthValue,
    resolvedHeightValue,
    isDimensionValid,
    isStoreWidthInvalid,
    manualOrderForm.curtainType,
    storePricePerM2,
    panneauConfig,
  ]);

  const computedItemTotalCost = useMemo(() => {
    if (!isQuantityValid) return 0;
    return Math.trunc(priceCalculation.total * quantityValue);
  }, [priceCalculation.total, quantityValue, isQuantityValid]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(price);

  const selectedPanneauWidth = useMemo(
    () => panneauConfig.widths.find((entry) => entry.widthCm === widthValue),
    [panneauConfig.widths, widthValue]
  );

  const displayOrderTotal = useMemo(() => {
    if (!isQuantityValid) {
      return 0;
    }

    return (
      priceCalculation.total * quantityValue +
      (installationSelected ? installationFeeValue : 0)
    );
  }, [
    priceCalculation.total,
    quantityValue,
    isQuantityValid,
    installationSelected,
    installationFeeValue,
  ]);

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/connexion");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const orderId = router.query.orderId;
    if (typeof orderId !== "string" || !orderId.trim()) {
      return;
    }

    const normalizedOrderId = orderId.trim();
    hasScrolledToFocusedOrder.current = false;
    setFocusedOrderId(normalizedOrderId);
    setFocusOrderLookup(normalizedOrderId);
    setSelectedStatus("");
    setCurrentPage(1);
  }, [router.isReady, router.query.orderId]);

  useEffect(() => {
    return subscribeToPriceSettingsUpdates(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-store-price"] });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!isManualOrderModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsManualOrderModalOpen(false);
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isManualOrderModalOpen]);

  useEffect(() => {
    if (!isManualOrderModalOpen || typeof installationFeeData?.fee !== "number") {
      return;
    }
    setManualOrderForm((prev) => {
      if (prev.installationFee !== "0" && prev.installationFee !== "11") {
        return prev;
      }
      return { ...prev, installationFee: installationFeeData.fee.toFixed(2) };
    });
  }, [isManualOrderModalOpen, installationFeeData]);

  useEffect(() => {
    setManualOrderForm((prev) => {
      const hasSelectedManualReferenceForType = hasSelectedManualReferenceByType[prev.curtainType];
      if (prev.curtainType === "panneau") {
        const nextWidth =
          prev.width !== "" && panneauWidthValues.has(Number(prev.width)) ? prev.width : "";
        const hasAllowedProduct = panneauProducts.some((product) => product._id === prev.productId);
        const nextProductId = hasAllowedProduct
          ? prev.productId
          : hasSelectedManualReferenceForType && panneauProducts.length > 0
            ? panneauProducts[0]._id
            : "";
        if (
          nextWidth === prev.width &&
          prev.height === panneauConfig.fixedHeightCm.toString() &&
          nextProductId === prev.productId
        ) {
          return prev;
        }
        return {
          ...prev,
          width: nextWidth,
          height: panneauConfig.fixedHeightCm.toString(),
          productId: nextProductId,
        };
      }

      const nextWidth =
        prev.width !== "" && panneauWidthValues.has(Number(prev.width)) ? "" : prev.width;
      const nextHeight =
        prev.height === panneauConfig.fixedHeightCm.toString() ? "" : prev.height;
      const hasCurrentProduct = products.some((product) => product._id === prev.productId);
      const nextProductId = hasCurrentProduct
        ? prev.productId
        : hasSelectedManualReferenceForType && products.length > 0
          ? products[0]._id
          : "";

      if (
        nextWidth === prev.width &&
        nextHeight === prev.height &&
        nextProductId === prev.productId
      ) {
        return prev;
      }

      return {
        ...prev,
        width: nextWidth,
        height: nextHeight,
        productId: nextProductId,
      };
    });
    setManualStoreWidthError("");
  }, [manualOrderForm.curtainType, panneauProducts, products, hasSelectedManualReferenceByType, panneauConfig.fixedHeightCm, panneauWidthValues]);

  const orderIdLookup = focusOrderLookup?.trim() || "";

  // Fetch orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["admin-orders", selectedStatus, searchTerm.trim(), orderIdLookup, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        includeStats: "true",
        ...(selectedStatus && { status: selectedStatus }),
        ...(searchTerm.trim() && { search: searchTerm.trim() }),
        ...(orderIdLookup && { orderId: orderIdLookup }),
      });

      const response = await fetch(`/api/admin/orders?${params}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
  });

  useEffect(() => {
    if (!focusedOrderId || isLoading || hasScrolledToFocusedOrder.current) {
      return;
    }

    const isVisible = ordersData?.orders?.some((order: any) => order._id === focusedOrderId);
    if (!isVisible) {
      return;
    }

    const element = document.getElementById(`admin-order-${focusedOrderId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    hasScrolledToFocusedOrder.current = true;
    setFocusOrderLookup(null);

    if (router.query.orderId) {
      const { orderId: _removed, ...restQuery } = router.query;
      void router.replace({ pathname: router.pathname, query: restQuery }, undefined, {
        shallow: true,
      });
    }
  }, [focusedOrderId, isLoading, ordersData, router]);

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await fetch(`/api/admin/orders?id=${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onMutate: async ({ orderId, status }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ADMIN_ORDERS_LIST_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: ADMIN_ORDERS_STATS_QUERY_KEY }),
      ]);

      const previousOrderQueries = queryClient.getQueriesData<AdminOrdersQueryData>({
        queryKey: ADMIN_ORDERS_LIST_QUERY_KEY,
      });
      const previousOrderStatsQuery = queryClient.getQueryData<AdminOrdersQueryData>(
        ADMIN_ORDERS_STATS_QUERY_KEY
      );

      for (const [queryKey] of previousOrderQueries) {
        queryClient.setQueryData<AdminOrdersQueryData>(queryKey, (oldData) =>
          applyOrderStatusUpdate(oldData, orderId, status)
        );
      }
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderStatusUpdate(oldData, orderId, status)
      );

      return { previousOrderQueries, previousOrderStatsQuery };
    },
    onSuccess: (updatedOrder, variables) => {
      const normalizedStatus = normalizeStatus(updatedOrder?.status || variables.status);

      queryClient.setQueriesData<AdminOrdersQueryData>(
        { queryKey: ADMIN_ORDERS_LIST_QUERY_KEY },
        (oldData) => applyOrderStatusUpdate(oldData, variables.orderId, normalizedStatus, updatedOrder)
      );
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderStatusUpdate(oldData, variables.orderId, normalizedStatus, updatedOrder)
      );

      success("Statut de commande mis à jour.");
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousOrderQueries) {
        for (const [queryKey, queryData] of context.previousOrderQueries) {
          queryClient.setQueryData(queryKey, queryData);
        }
      }
      if (context?.previousOrderStatsQuery) {
        queryClient.setQueryData(ADMIN_ORDERS_STATS_QUERY_KEY, context.previousOrderStatsQuery);
      }

      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  const handleInlineStatusUpdate = (orderId: string, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  const createOrderMutation = useMutation({
    mutationFn: async (payload: {
      customerInfo: {
        firstName: string;
        lastName: string;
        email?: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
      };
      item: {
        curtainTypeName: string;
        width: number;
        height: number;
        totalCost: number;
      };
      wantsInstallation: boolean;
      deliveryFee: number;
      installationFee: number;
      notes?: string;
    }) => {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onMutate: async (payload) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ADMIN_ORDERS_LIST_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: ADMIN_ORDERS_STATS_QUERY_KEY }),
      ]);

      const previousOrderQueries = queryClient.getQueriesData<AdminOrdersQueryData>({
        queryKey: ADMIN_ORDERS_LIST_QUERY_KEY,
      });
      const previousOrderStatsQuery = queryClient.getQueryData<AdminOrdersQueryData>(
        ADMIN_ORDERS_STATS_QUERY_KEY
      );

      const optimisticOrderId = `optimistic-${Date.now()}`;
      const optimisticOrder = {
        _id: optimisticOrderId,
        id: optimisticOrderId,
        status: "confirmed",
        totalAmount: Math.max(
          0,
          payload.item.totalCost +
            payload.deliveryFee +
            (payload.wantsInstallation ? payload.installationFee : 0)
        ),
        createdAt: new Date().toISOString(),
        customerInfo: payload.customerInfo,
        userId: {
          name: session?.user?.name || "Admin",
          email: session?.user?.email || "",
        },
        items: [
          {
            curtainTypeName: payload.item.curtainTypeName,
            width: payload.item.width,
            height: payload.item.height,
            totalCost: payload.item.totalCost,
          },
        ],
      };

      for (const [queryKey] of previousOrderQueries) {
        queryClient.setQueryData<AdminOrdersQueryData>(queryKey, (oldData) =>
          applyOrderCreateUpdate(oldData, optimisticOrder, queryKey)
        );
      }
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderCreateUpdate(oldData, optimisticOrder, ADMIN_ORDERS_LIST_QUERY_KEY)
      );

      return { previousOrderQueries, previousOrderStatsQuery, optimisticOrderId };
    },
    onSuccess: (createdOrder, _variables, context) => {
      if (context?.optimisticOrderId) {
        queryClient.setQueriesData<AdminOrdersQueryData>(
          { queryKey: ADMIN_ORDERS_LIST_QUERY_KEY },
          (oldData) => replaceOrderById(oldData, context.optimisticOrderId, createdOrder)
        );
        queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
          replaceOrderById(oldData, context.optimisticOrderId, createdOrder)
        );
      }

      setManualOrderForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        productId: "",
        curtainType: "panneau",
        width: "",
        height: "",
        quantity: "1",
        deliveryFee: "",
        installationFee:
          typeof installationFeeData?.fee === "number" ? installationFeeData.fee.toFixed(2) : "11",
        wantsInstallation: null,
        notes: "",
      });
      setHasSelectedManualReferenceByType({ panneau: false, store: false });
      setManualOrderError("");
      setManualStoreWidthError("");
      setManualEmailError("");
      setManualPhoneError("");
      setIsManualOrderModalOpen(false);
      success("Commande créée avec succès.");
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousOrderQueries) {
        for (const [queryKey, queryData] of context.previousOrderQueries) {
          queryClient.setQueryData(queryKey, queryData);
        }
      }
      if (context?.previousOrderStatsQuery) {
        queryClient.setQueryData(ADMIN_ORDERS_STATS_QUERY_KEY, context.previousOrderStatsQuery);
      }

      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      setManualOrderError(message);
      error(`Erreur: ${message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderError("");
    setManualStoreWidthError("");
    setManualEmailError("");
    setManualPhoneError("");

    const width = Number(manualOrderForm.width);
    const height =
      manualOrderForm.curtainType === "panneau"
        ? panneauConfig.fixedHeightCm
        : Number(manualOrderForm.height);
    const quantity = Number(manualOrderForm.quantity);
    const deliveryFee = Number(autoDeliveryFee);
    const installationFee =
      typeof installationFeeData?.fee === "number" ? installationFeeData.fee : Number(manualOrderForm.installationFee);
    const productName = selectedProductName;
    const normalizedEmail = normalizeEmailValue(manualOrderForm.email);
    const normalizedPhone = normalizePhoneValue(manualOrderForm.phone);
    const emailValidationError = getEmailValidationError(normalizedEmail);
    const phoneValidationError = getPhoneValidationError(normalizedPhone, { required: true });

    setManualOrderForm((prev) => ({
      ...prev,
      email: normalizedEmail,
      phone: normalizedPhone,
    }));
    if (emailValidationError) {
      setManualEmailError(emailValidationError);
      setManualOrderError(emailValidationError);
      return;
    }
    if (phoneValidationError) {
      setManualPhoneError(phoneValidationError);
      setManualOrderError(phoneValidationError);
      return;
    }

    if ([width, height, quantity, deliveryFee, installationFee].some((n) => Number.isNaN(n))) {
      setManualOrderError("Veuillez saisir des valeurs numériques valides.");
      return;
    }
    if (!productName) {
      setManualOrderError("Veuillez sélectionner une référence.");
      return;
    }
    if (
      manualOrderForm.curtainType === "panneau" &&
      !panneauProducts.some((product) => product._id === manualOrderForm.productId)
    ) {
      setManualOrderError("Veuillez sélectionner une référence panneau autorisée.");
      return;
    }
    if (width <= 0 || height <= 0) {
      setManualOrderError("Les dimensions doivent être supérieures à 0.");
      return;
    }
    if (
      manualOrderForm.curtainType === "panneau" &&
      !panneauWidthValues.has(width)
    ) {
      setManualOrderError("Veuillez sélectionner une largeur panneau valide.");
      return;
    }
    if (manualOrderForm.curtainType === "store" && width > STORE_WIDTH_MAX) {
      setManualStoreWidthError(`La largeur ne peut pas dépasser ${STORE_WIDTH_MAX} cm.`);
      setManualOrderError("Veuillez corriger la largeur du store.");
      return;
    }
    if (quantity <= 0) {
      setManualOrderError("La quantité doit être supérieure à 0.");
      return;
    }
    if (manualOrderForm.wantsInstallation === null) {
      setManualOrderError("Veuillez préciser si le client souhaite la pose.");
      return;
    }

    createOrderMutation.mutate({
      customerInfo: {
        firstName: manualOrderForm.firstName.trim(),
        lastName: manualOrderForm.lastName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        address: manualOrderForm.address.trim(),
        city: manualOrderForm.city.trim(),
        state: manualOrderForm.state.trim(),
        postalCode: manualOrderForm.postalCode.trim(),
      },
      item: {
        curtainTypeName: `${productName} - ${
          manualOrderForm.curtainType === "panneau" ? "Panneau" : "Store"
        }`,
        width,
        height,
        totalCost: computedItemTotalCost,
      },
      wantsInstallation: manualOrderForm.wantsInstallation === true,
      deliveryFee,
      installationFee,
      notes: manualOrderForm.notes.trim(),
    });
  };

  const formatInvoiceDate = (value: string | Date) =>
    new Date(value).toLocaleString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const printInvoice = (order: any) => {
    const customer = order.customerInfo || {};
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const invoiceNumber = `RB-${(order._id?.slice(-8) || "--------").toUpperCase()}`;
    const orderDate = formatInvoiceDate(order.createdAt);
    const subtotal =
      (order.totalAmount || 0) - (order.deliveryFee || 0) - (order.installationFee || 0);

    const itemsRows = orderItems
      .map((item: any) => {
        const productName = escapeHtml(item.curtainTypeName || "Article");
        const dimensions = escapeHtml(`${item.width || 0} cm × ${item.height || 0} cm`);
        const amount = escapeHtml(`${(item.totalCost || 0).toFixed(2)} TND`);

        return `
          <tr>
            <td>${productName}</td>
            <td>${dimensions}</td>
            <td>${amount}</td>
          </tr>
        `;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoiceNumber)}</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
      }
      body {
        font-family: Arial, sans-serif;
        color: #111;
        padding: 18mm 16mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice-header {
        text-align: center;
        margin-bottom: 28px;
      }
      .brand {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #666;
      }
      .invoice-title {
        margin: 10px 0 0;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .invoice-meta {
        margin: 12px 0 0;
        color: #555;
        font-size: 14px;
      }
      .client-block {
        margin-bottom: 20px;
        line-height: 1.7;
        font-size: 14px;
      }
      .client-block strong {
        display: inline-block;
        min-width: 88px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 10px;
        text-align: left;
        font-size: 14px;
      }
      th {
        background: #f4f4f4;
        font-weight: 700;
      }
      .totals {
        margin-top: 18px;
        width: 320px;
        margin-left: auto;
      }
      .totals p {
        display: flex;
        justify-content: space-between;
        margin: 7px 0;
        font-size: 14px;
      }
      .grand {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 2px solid #111;
        font-size: 18px;
        font-weight: 700;
      }
      @media print {
        body {
          padding: 18mm 16mm;
        }
      }
    </style>
  </head>
  <body>
    <header class="invoice-header">
      <div class="brand">Rideaux Bambou</div>
      <h1 class="invoice-title">Facture</h1>
      <p class="invoice-meta">N° ${escapeHtml(invoiceNumber)} · ${escapeHtml(orderDate)}</p>
    </header>

    <section class="client-block">
      <p><strong>Client :</strong> ${escapeHtml(getCustomerFullName(customer))}</p>
      <p><strong>Téléphone :</strong> ${escapeHtml(customer.phone || "—")}</p>
      <p><strong>Adresse :</strong> ${escapeHtml(
        [customer.address, customer.city, customer.state].filter(Boolean).join(", ") || "—"
      )}</p>
    </section>

    <table>
      <thead>
        <tr>
          <th>Produit</th>
          <th>Dimensions</th>
          <th>Montant</th>
        </tr>
      </thead>
      <tbody>${itemsRows || "<tr><td colspan='3'>Aucun article</td></tr>"}</tbody>
    </table>

    <div class="totals">
      <p><span>Sous-total</span><span>${subtotal.toFixed(2)} TND</span></p>
      <p><span>Livraison</span><span>${(order.deliveryFee || 0).toFixed(2)} TND</span></p>
      <p><span>Pose</span><span>${(order.installationFee || 0).toFixed(2)} TND</span></p>
      <p class="grand"><span>Total</span><span>${(order.totalAmount || 0).toFixed(2)} TND</span></p>
    </div>
  </body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "style",
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    );
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        error("Impossible d'ouvrir la fenêtre d'impression.");
        document.body.removeChild(iframe);
        return;
      }

      printWindow.focus();
      printWindow.print();

      window.setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };
  };

  const getCustomerFullName = (customerInfo: any) => {
    const firstName = customerInfo?.firstName?.trim() || "";
    const lastName = customerInfo?.lastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || customerInfo?.name || "Client";
  };

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Manage Orders - Rideaux Bambou Admin" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <BackButton href="/admin" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Header */}
            <div>
              <div className="mb-14 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Gestion des Commandes
                </h1>
                <Button
                  type="button"
                  onClick={() => {
                    setHasSelectedManualReferenceByType({ panneau: false, store: false });
                    setManualOrderError("");
                    setManualStoreWidthError("");
                    setManualOrderForm((prev) => ({
                      ...prev,
                      productId: "",
                      installationFee:
                        typeof installationFeeData?.fee === "number"
                          ? installationFeeData.fee.toFixed(2)
                          : prev.installationFee,
                    }));
                    setIsManualOrderModalOpen(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  Ajouter une commande
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label="Rechercher une commande"
                  placeholder="ID commande, client ou téléphone"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusOrderLookup(null);
                    setCurrentPage(1);
                  }}
                />
                <div className="md:justify-self-end md:w-[10.5rem]">
                  <label className={formFieldLabelClass}>Filtrer par statut</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={formSelectClass}
                  >
                    <option value="" className="text-gray-900 dark:text-white">
                      Tous les statuts
                    </option>
                    {statusOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="text-gray-900 dark:text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            {ordersData?.stats && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    ⏳
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    En Attente
                  </h3>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {ordersData.stats.pendingOrders}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-blue-600 dark:text-blue-400">✅</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Confirmées
                  </h3>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {ordersData.stats.confirmedOrders || 0}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.28 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-purple-600 dark:text-purple-400">🛠️</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    En cours
                  </h3>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {ordersData.stats.processingOrders || 0}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.35 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-green-600 dark:text-green-400">
                    ✓
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Livrées
                  </h3>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {ordersData.stats.deliveredOrders}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-red-600 dark:text-red-400">✕</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Annulées
                  </h3>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {ordersData.stats.cancelledOrders || 0}
                  </p>
                </motion.div>
              </div>
            )}

            {isManualOrderModalOpen && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-3 py-6"
                onClick={() => setIsManualOrderModalOpen(false)}
              >
                <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl">
                  <Card className="max-h-[95vh] w-full overflow-y-auto overscroll-contain p-4 sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Ajouter une commande
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsManualOrderModalOpen(false)}
                        disabled={createOrderMutation.isPending}
                        aria-label="Fermer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-xl leading-none text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <span aria-hidden="true">&times;</span>
                      </button>
                    </div>

                    <form onSubmit={handleCreateManualOrder} className="space-y-5">
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Configuration produit
                          </h4>
                          <div>
                            <label className={formFieldLabelClass}>
                              Référence
                            </label>
                            <select
                              value={manualOrderForm.productId}
                              onChange={(e) => handleManualReferenceChange(e.target.value)}
                              className={`${formSelectClass} ${
                                !hasSelectedManualReferenceForCurrentType &&
                                manualOrderForm.productId === ""
                                  ? "text-gray-400 dark:text-gray-400"
                                  : "text-gray-900 dark:text-white"
                              }`}
                              required
                              disabled={isProductsLoading || selectableManualProducts.length === 0}
                            >
                              {!hasSelectedManualReferenceForCurrentType &&
                                manualOrderForm.productId === "" && (
                                <option value="" className="text-gray-400">
                                  Choisir la référence
                                </option>
                              )}
                              {selectableManualProducts.map((product) => (
                                <option key={product._id} value={product._id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                            {selectableManualProducts.length === 0 && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {manualOrderForm.curtainType === "panneau"
                                  ? "Aucune référence panneau configurée."
                                  : "Aucune référence active disponible."}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className={formFieldLabelClass}>
                              Type de rideau
                            </label>
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <input
                                  type="radio"
                                  name="manual-curtain-type"
                                  value="panneau"
                                  checked={manualOrderForm.curtainType === "panneau"}
                                  onChange={() =>
                                    setManualOrderForm((prev) => ({ ...prev, curtainType: "panneau" }))
                                  }
                                  className="sr-only"
                                />
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                  <span
                                    className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                      manualOrderForm.curtainType === "panneau"
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                </span>
                                Panneau
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <input
                                  type="radio"
                                  name="manual-curtain-type"
                                  value="store"
                                  checked={manualOrderForm.curtainType === "store"}
                                  onChange={() =>
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      curtainType: "store",
                                      height: "",
                                    }))
                                  }
                                  className="sr-only"
                                />
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                  <span
                                    className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                      manualOrderForm.curtainType === "store" ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                </span>
                                Store
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className={formFieldLabelClass}>
                                Largeur (cm)
                              </label>
                              {manualOrderForm.curtainType === "panneau" ? (
                                <select
                                  value={manualOrderForm.width}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({ ...prev, width: e.target.value }))
                                  }
                                  className={formSelectClass}
                                  style={{
                                    color: manualOrderForm.width === "" ? "#9CA3AF" : undefined,
                                  }}
                                  required
                                >
                                  <option value="" style={{ color: "#9CA3AF" }}>
                                    Choisir la largeur
                                  </option>
                                  {panneauConfig.widths.map((entry) => (
                                    <option key={entry.id} value={entry.widthCm}>
                                      {formatPanneauWidthOption(entry)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  value={manualOrderForm.width}
                                  onChange={(e) => {
                                    const nextWidth = e.target.value;
                                    setManualOrderForm((prev) => ({ ...prev, width: nextWidth }));
                                    if (!nextWidth) {
                                      setManualStoreWidthError("");
                                      return;
                                    }
                                    const parsed = Number(nextWidth);
                                    if (!Number.isNaN(parsed) && parsed > STORE_WIDTH_MAX) {
                                      setManualStoreWidthError(
                                        `La largeur ne peut pas dépasser ${STORE_WIDTH_MAX} cm.`
                                      );
                                    } else {
                                      setManualStoreWidthError("");
                                    }
                                  }}
                                  min={1}
                                  max={STORE_WIDTH_MAX}
                                  step={1}
                                  className={formNumberFieldClass}
                                  required
                                />
                              )}
                              {manualOrderForm.curtainType !== "panneau" && (
                                <>
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Largeur maximale: {STORE_WIDTH_MAX} cm.
                                  </p>
                                  {manualStoreWidthError && (
                                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                      {manualStoreWidthError}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <div>
                              <label className={formFieldLabelClass}>
                                Hauteur (cm)
                              </label>
                              {manualOrderForm.curtainType === "panneau" ? (
                                <input
                                  type="number"
                                  value={panneauConfig.fixedHeightCm}
                                  disabled
                                  className={formFieldDisabledClass}
                                />
                              ) : (
                                <input
                                  type="number"
                                  value={manualOrderForm.height}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({ ...prev, height: e.target.value }))
                                  }
                                  min={1}
                                  step={1}
                                  className={formNumberFieldClass}
                                  required
                                />
                              )}
                            </div>
                          </div>

                          <div>
                            <label className={formFieldLabelClass}>
                              Pose
                            </label>
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <input
                                  type="radio"
                                  name="manual-installation"
                                  checked={manualOrderForm.wantsInstallation === true}
                                  onChange={() =>
                                    setManualOrderForm((prev) => ({ ...prev, wantsInstallation: true }))
                                  }
                                  className="sr-only"
                                />
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                  <span
                                    className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                      manualOrderForm.wantsInstallation === true
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                </span>
                                Oui
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <input
                                  type="radio"
                                  name="manual-installation"
                                  checked={manualOrderForm.wantsInstallation === false}
                                  onChange={() =>
                                    setManualOrderForm((prev) => ({ ...prev, wantsInstallation: false }))
                                  }
                                  className="sr-only"
                                />
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                  <span
                                    className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                      manualOrderForm.wantsInstallation === false
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                </span>
                                Non
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className={formFieldLabelClass}>
                              Quantité
                            </label>
                            <div className="flex flex-wrap items-center justify-start gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setManualOrderForm((prev) => ({
                                    ...prev,
                                    quantity: Math.max(1, Number(prev.quantity || "1") - 1).toString(),
                                  }))
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={manualOrderForm.quantity}
                                readOnly
                                className="w-9 rounded-md border border-gray-300 px-0 py-1 text-center text-xs font-medium leading-none focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                style={{ textAlign: "center" }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setManualOrderForm((prev) => ({
                                    ...prev,
                                    quantity: Math.min(10, Number(prev.quantity || "1") + 1).toString(),
                                  }))
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                              <div className="flex justify-between">
                                <span>
                                  {manualOrderForm.curtainType === "panneau" ? "Prix:" : "Prix par m²:"}
                                </span>
                                <span>
                                  {manualOrderForm.curtainType === "panneau" ? (
                                    !selectedPanneauWidth ? (
                                      formatPrice(priceCalculation.total)
                                    ) : (
                                      <PriceDisplay
                                        pricePerM2={selectedPanneauWidth.price}
                                        salePricePerM2={selectedPanneauWidth.salePrice}
                                        isSaleActive={panneauConfig.isSaleActive === true}
                                        suffix=""
                                        inline
                                        listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                                        saleClassName="text-sm font-semibold text-green-600 dark:text-green-400"
                                      />
                                    )
                                  ) : (
                                    <PriceDisplay
                                      pricePerM2={storePriceData?.pricePerM2 ?? 77}
                                      salePricePerM2={storePriceData?.salePricePerM2}
                                      isSaleActive={storePriceData?.isSaleActive === true}
                                      suffix=""
                                      inline
                                      listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                                      saleClassName="text-sm font-semibold text-green-600 dark:text-green-400"
                                    />
                                  )}
                                </span>
                              </div>
                              {installationSelected ? (
                                <div className="flex justify-between text-sm">
                                  <span>Frais de pose</span>
                                  <span>{formatPrice(installationFeeValue)}</span>
                                </div>
                              ) : null}
                              <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                                <span>Total</span>
                                <span>{formatPrice(displayOrderTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Informations client
                          </h4>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className={formFieldLabelClass}>Prénom</label>
                              <input
                                type="text"
                                value={manualOrderForm.firstName}
                                onChange={(e) =>
                                  setManualOrderForm((prev) => ({ ...prev, firstName: e.target.value }))
                                }
                                className={formFieldClass}
                                required
                              />
                            </div>
                            <div>
                              <label className={formFieldLabelClass}>Nom</label>
                              <input
                                type="text"
                                value={manualOrderForm.lastName}
                                onChange={(e) =>
                                  setManualOrderForm((prev) => ({ ...prev, lastName: e.target.value }))
                                }
                                className={formFieldClass}
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className={formFieldLabelClass}>Email (optionnel)</label>
                            <input
                              type="email"
                              value={manualOrderForm.email}
                              onChange={(e) => {
                                const nextEmail = e.target.value;
                                setManualOrderForm((prev) => ({ ...prev, email: nextEmail }));
                                if (manualEmailError) {
                                  setManualEmailError(getEmailValidationError(nextEmail));
                                }
                              }}
                              onBlur={() => {
                                const normalizedEmail = normalizeEmailValue(manualOrderForm.email);
                                setManualOrderForm((prev) => ({ ...prev, email: normalizedEmail }));
                                setManualEmailError(getEmailValidationError(normalizedEmail));
                              }}
                              className={`${formFieldClass} ${manualEmailError ? formFieldErrorClass : ""}`}
                            />
                            {manualEmailError && (
                              <p className="mt-1 text-xs text-red-500">{manualEmailError}</p>
                            )}
                          </div>
                          <div>
                            <label className={formFieldLabelClass}>Téléphone</label>
                            <input
                              type="text"
                              value={manualOrderForm.phone}
                              onChange={(e) => {
                                const normalizedPhone = normalizePhoneValue(e.target.value);
                                setManualOrderForm((prev) => ({ ...prev, phone: normalizedPhone }));
                                if (manualPhoneError) {
                                  setManualPhoneError(
                                    getPhoneValidationError(normalizedPhone, { required: true })
                                  );
                                }
                              }}
                              onBlur={() =>
                                setManualPhoneError(
                                  getPhoneValidationError(manualOrderForm.phone, { required: true })
                                )
                              }
                              inputMode="numeric"
                              maxLength={8}
                              pattern="[0-9]*"
                              className={`${formFieldClass} ${manualPhoneError ? formFieldErrorClass : ""}`}
                              required
                            />
                            {manualPhoneError && (
                              <p className="mt-1 text-xs text-red-500">{manualPhoneError}</p>
                            )}
                          </div>
                          <div>
                            <label className={formFieldLabelClass}>Adresse</label>
                            <input
                              type="text"
                              value={manualOrderForm.address}
                              onChange={(e) =>
                                setManualOrderForm((prev) => ({ ...prev, address: e.target.value }))
                              }
                              className={formFieldClass}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className={formFieldLabelClass}>Région</label>
                              <select
                                value={manualOrderForm.state}
                                onChange={(e) =>
                                  setManualOrderForm((prev) => ({
                                    ...prev,
                                    state: resolveGovernorateName(e.target.value),
                                    city: "",
                                  }))
                                }
                                className={formSelectClass}
                                required
                              >
                                <option value="">Sélectionnez un gouvernorat</option>
                                {TUNISIAN_GOVERNORATES.map((governorate) => (
                                  <option key={governorate} value={governorate}>
                                    {governorate}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={formFieldLabelClass}>Ville</label>
                              <select
                                value={manualOrderForm.city}
                                onChange={(e) =>
                                  setManualOrderForm((prev) => ({ ...prev, city: e.target.value }))
                                }
                                disabled={!manualOrderForm.state}
                                className={formSelectDisabledClass}
                                required
                              >
                                <option value="">
                                  {manualOrderForm.state
                                    ? "Sélectionnez une ville"
                                    : "Sélectionnez d'abord un gouvernorat"}
                                </option>
                                {citiesForSelectedGovernorate.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className={formFieldLabelClass}>Code postal</label>
                            <input
                              type="text"
                              value={manualOrderForm.postalCode}
                              onChange={(e) =>
                                setManualOrderForm((prev) => ({ ...prev, postalCode: e.target.value }))
                              }
                              className={formFieldClass}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className={formFieldLabelClass}>
                          Notes (optionnel)
                        </label>
                        <textarea
                          value={manualOrderForm.notes}
                          onChange={(e) =>
                            setManualOrderForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          rows={3}
                          className={formTextareaClass}
                        />
                      </div>

                      {manualOrderError && (
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          {manualOrderError}
                        </p>
                      )}

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          loading={createOrderMutation.isPending}
                          disabled={
                            createOrderMutation.isPending ||
                            Boolean(manualEmailError) ||
                            Boolean(manualPhoneError)
                          }
                          className="w-full sm:w-auto"
                        >
                          {createOrderMutation.isPending ? "Création..." : "Créer la commande"}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </div>
              </div>
            )}

            {/* Orders Table */}
            <div className={adminTableShellClassName}>
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Chargement des commandes...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {ordersData?.orders?.map((order: any) => (
                      <div
                        key={`${order._id}-mobile`}
                        id={`admin-order-${order._id}`}
                        className={`rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 ${getFocusedOrderClass(order._id)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              #{order._id.slice(-8)}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {getCustomerFullName(order.customerInfo)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              statusColors[normalizeStatus(order.status)] ||
                              "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {statusLabels[normalizeStatus(order.status)]}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <p>Total: {order.totalAmount?.toFixed(2) || "0.00"} TND</p>
                          <p>Région: {order.customerInfo?.state || "N/A"}</p>
                          <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={normalizeStatus(order.status)}
                            onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                            disabled={updateStatusMutation.isPending}
                              className={formSelectClass}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => printInvoice(order)}
                          >
                            Imprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:flex md:justify-center md:overflow-x-auto">
                    <table className="w-max max-w-full table-auto divide-y divide-gray-200 [&_td]:px-3 [&_th]:px-3 [&_th]:font-semibold [&_th]:tracking-wide sm:[&_td]:px-4 sm:[&_th]:px-4 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          ID Commande
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Client
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Produit
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Dimensions
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Total
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Région
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Pose
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Statut
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Date
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Facture
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {ordersData?.orders?.map((order: any) => (
                        <tr
                          key={order._id}
                          id={`admin-order-${order._id}`}
                          className={getFocusedOrderClass(order._id)}
                        >
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center font-mono text-sm text-gray-900 dark:text-white">
                            #{order._id.slice(-8)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center">
                            <div className="text-center">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {getCustomerFullName(order.customerInfo)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 sm:px-4 text-center text-sm text-gray-900 dark:text-white">
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-product-${index}`}>
                                  {item.curtainTypeName || "N/A"}
                                </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                            </div>
                          </td>
                          <td className="px-3 py-4 sm:px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-dimension-${index}`}>
                                  {item.width}cm × {item.height}cm
                                </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center text-sm font-medium text-gray-900 dark:text-white">
                            {order.totalAmount?.toFixed(2) || "0.00"} TND
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            {order.customerInfo.state || "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                order.wantsInstallation
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {order.wantsInstallation ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center">
                            <select
                              value={normalizeStatus(order.status)}
                              onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                              disabled={updateStatusMutation.isPending}
                              className={formSelectClass}
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 sm:px-4 text-center">
                            <Button type="button" size="sm" variant="secondary" onClick={() => printInvoice(order)}>
                              Imprimer
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Pagination */}
              {ordersData?.pagination && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(
                          Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                        )
                      }
                      disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Suivant
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Page <span className="font-medium">{currentPage}</span> sur{" "}
                        <span className="font-medium">
                          {ordersData?.pagination?.totalPages || 1}
                        </span>{" "}
                        ({ordersData?.pagination?.totalOrders || 0} commandes au total)
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                        >
                          Précédent
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPage(
                              Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                            )
                          }
                          disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                          className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                        >
                          Suivant
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </main>

      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Gestion des Commandes - Rideaux Bambou Admin");
