import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo, useRef } from "react";

import AdminNavigation from "../../components/AdminNavigation";
import BackButton from "../../components/BackButton";
import Footer from "../../components/Footer";
import StorePanelBreakdown from "../../components/StorePanelBreakdown";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { escapeHtml } from "../../lib/email-templates";
import { getEmailValidationError, normalizeEmailValue } from "../../lib/email-validation";
import {
  CUSTOMER_TYPE_LABELS,
  getCustomerDisplayName,
  getCustomerTypeLabel,
  readMatriculeFiscale,
  type CustomerType,
} from "../../lib/customer-info";
import { amountToFrenchWordsTnd } from "../../lib/french-amount";
import {
  applyMatriculeFiscaleInput,
  formatMatriculeFiscale,
  formatMatriculeFiscaleForDisplay,
  getMatriculeFiscaleValidationError,
  MATRICULE_FISCALE_FORMAT,
} from "../../lib/matricule-fiscale";
import { calculateOrderInvoiceTotals, getOrderDisplayTotal, getOrderSummaryLines, getPrintedInvoiceGrandTotal, getPrintedInvoiceLines } from "../../lib/invoice-totals";
import { parseDeliveryFeesResponse } from "../../lib/delivery-fees-query";
import { formatCurtainTypeName, normalizeCurtainTypeName } from "../../lib/curtain-type-name";
import { computeCurtainPrice, getCurtainLineTotal } from "../../lib/order-pricing";
import {
  getStorePanelMeasurements,
} from "../../lib/store-panel-count";
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
import { parseMeasurement, sanitizeMeasurementInput } from "../../lib/measurement-input";

const PAGE_TITLE = "Gestion des Commandes - Rideaux Bambou Admin";

interface Product {
  _id: string;
  name: string;
  supportsPanneau?: boolean;
  isAvailable?: boolean;
}

type CanonicalOrderStatus = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
type CurtainType = "panneau" | "store";

type ManualOrderLineItem = {
  id: string;
  productId: string;
  productName: string;
  curtainType: CurtainType;
  width: number;
  height: number;
  quantity: number;
  totalCost: number;
};

const parseStoredCurtainType = (item: Record<string, unknown>): CurtainType => {
  if (item.curtainType === "panneau" || item.curtainType === "store") {
    return item.curtainType;
  }
  const name = String(item.curtainTypeName || "");
  if (/\bpanneau\b/i.test(name)) {
    return "panneau";
  }
  return "store";
};

const parseStoredProductName = (item: Record<string, unknown>): string => {
  const raw = String(item.curtainTypeName || "").trim();
  const dashMatch = raw.match(/^(.+?)\s*-\s*(Panneau|Store)\s*$/i);
  if (dashMatch) {
    return dashMatch[1].trim();
  }
  const parenMatch = raw.match(/^(.+?)\s*\((Panneau|Store)\)\s*$/i);
  if (parenMatch) {
    return parenMatch[1].trim();
  }
  return raw || "Produit";
};

const mapOrderItemsToManualLines = (items: unknown): ManualOrderLineItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((raw, index) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      id: `existing-${index}-${String(item.curtainTypeId || index)}`,
      productId: String(item.curtainTypeId || "manual-admin"),
      productName: parseStoredProductName(item),
      curtainType: parseStoredCurtainType(item),
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      totalCost: Math.max(0, Number(item.totalCost) || 0),
    };
  });
};

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

const customerTypeBadgeClass = {
  company: "bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-600/15 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-400/20",
  person: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
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

function parseCustomerInfo(customerInfo?: Record<string, unknown>) {
  const info = customerInfo || {};
  const customerType = info.customerType === "company" ? "company" : "person";
  const firstName = typeof info.firstName === "string" ? info.firstName.trim() : "";
  const lastName = typeof info.lastName === "string" ? info.lastName.trim() : "";
  const legacyName = typeof info.name === "string" ? info.name.trim() : "";
  const companyName = typeof info.companyName === "string" ? info.companyName.trim() : "";
  const matriculeFiscaleRaw = readMatriculeFiscale(info);
  const matriculeFiscaleDisplay = matriculeFiscaleRaw
    ? formatMatriculeFiscaleForDisplay(matriculeFiscaleRaw)
    : "N/A";
  const readField = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : "N/A";

  return {
    customerType,
    customerTypeLabel: getCustomerTypeLabel(info),
    name: getCustomerDisplayName(info),
    companyName: companyName || "N/A",
    taxId: matriculeFiscaleRaw || "N/A",
    matriculeFiscale: matriculeFiscaleDisplay,
    firstName: firstName || "N/A",
    lastName: lastName || "N/A",
    legacyName: legacyName || "N/A",
    phone: readField(info.phone),
    email: readField(info.email),
    address: readField(info.address),
    city: readField(info.city),
    state: readField(info.state),
    postalCode: readField(info.postalCode),
  };
}

const orderTableHeadClass =
  "whitespace-nowrap px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-4";
const orderTableCellClass =
  "whitespace-nowrap px-3 py-4 text-center text-sm text-gray-900 dark:text-white sm:px-4";
const orderTableAddressCellClass =
  "max-w-[14rem] px-3 py-4 text-center text-sm text-gray-900 dark:text-white sm:px-4";

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

const applyOrderDeleteUpdate = (
  oldData: AdminOrdersQueryData | undefined,
  orderId: string
) => {
  if (!oldData?.orders) {
    return oldData;
  }

  const orderToRemove = oldData.orders.find((order) => order._id === orderId);
  if (!orderToRemove) {
    return oldData;
  }

  const nextOrders = oldData.orders.filter((order) => order._id !== orderId);
  const normalizedStatus = normalizeStatus(orderToRemove.status);
  const statsKey = statusToStatsKey[normalizedStatus];
  const nextStats: OrderStats = { ...(oldData.stats || {}) };
  nextStats.totalOrders = Math.max(0, (nextStats.totalOrders || 0) - 1);
  nextStats[statsKey] = Math.max(0, (nextStats[statsKey] || 0) - 1);

  const previousTotalOrders = oldData.pagination?.totalOrders || 0;
  const pageSize = Math.max(oldData.orders.length || 10, 1);
  const nextTotalOrders = Math.max(0, previousTotalOrders - 1);

  return {
    ...oldData,
    orders: nextOrders,
    stats: nextStats,
    pagination: oldData.pagination
      ? {
          ...oldData.pagination,
          totalOrders: nextTotalOrders,
          totalPages: Math.max(1, Math.ceil(Math.max(nextTotalOrders, 1) / pageSize)),
        }
      : oldData.pagination,
  };
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

const applyOrderItemsUpdate = (
  oldData: AdminOrdersQueryData | undefined,
  orderId: string,
  items: any[],
  totalAmount: number,
  updatedOrder?: any
) => {
  if (!oldData?.orders) {
    return oldData;
  }

  return {
    ...oldData,
    orders: oldData.orders.map((order) => {
      if (order._id !== orderId) {
        return order;
      }
      return {
        ...order,
        ...(updatedOrder || {}),
        items,
        totalAmount,
        _id: orderId,
      };
    }),
  };
};

export default function AdminOrders() {
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
  const [editingOrder, setEditingOrder] = useState<{
    id: string;
    deliveryFee: number;
    installationFee: number;
    wantsInstallation: boolean;
  } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; label: string } | null>(null);
  const [manualOrderError, setManualOrderError] = useState("");
  const [manualEmailError, setManualEmailError] = useState("");
  const [manualPhoneError, setManualPhoneError] = useState("");
  const [manualMatriculeFiscaleError, setManualMatriculeFiscaleError] = useState("");
  const [hasSelectedManualReferenceByType, setHasSelectedManualReferenceByType] = useState<
    Record<CurtainType, boolean>
  >({
    panneau: false,
    store: false,
  });
  const [manualOrderForm, setManualOrderForm] = useState({
    customerType: "person" as CustomerType,
    firstName: "",
    lastName: "",
    companyName: "",
    matriculeFiscale: "",
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
  const [manualOrderItems, setManualOrderItems] = useState<ManualOrderLineItem[]>([]);
  const isManualCompanyOrder = manualOrderForm.customerType === "company";
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

  const { data: deliveryFeesPayload } = useQuery({
    queryKey: ["admin-orders-delivery-fees"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/delivery-fees");
        const data = await response.json();
        return data.success ? parseDeliveryFeesResponse(data.data) : parseDeliveryFeesResponse([]);
      } catch {
        return parseDeliveryFeesResponse([]);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const deliveryFees = deliveryFeesPayload?.fees ?? [];
  const isFreeDeliveryActive = deliveryFeesPayload?.isFreeDeliveryActive === true;

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
  const hasSelectedRegion = manualOrderForm.state.trim().length > 0;
  const autoDeliveryFee = hasSelectedRegion
    ? deliveryFees.find(
        (fee: any) =>
          normalizeGovernorate(fee.state) === normalizedSelectedState || fee.stateCode === selectedStateCode
      )?.fee ?? 0
    : 0;

  const widthValue = parseMeasurement(manualOrderForm.width);
  const heightValue = parseMeasurement(manualOrderForm.height);
  const quantityValue = Number(manualOrderForm.quantity);
  const installationFeeValue =
    typeof installationFeeData?.fee === "number" ? installationFeeData.fee : Number(manualOrderForm.installationFee);
  const hasWidth = manualOrderForm.width !== "";
  const hasHeight = manualOrderForm.curtainType === "panneau" || manualOrderForm.height !== "";
  const resolvedHeightValue =
    manualOrderForm.curtainType === "panneau" ? panneauConfig.fixedHeightCm : heightValue;

  const isDimensionValid = hasWidth && hasHeight && widthValue > 0 && resolvedHeightValue > 0;
  const isQuantityValid = quantityValue > 0;
  const installationSelected = manualOrderForm.wantsInstallation === true;

  const priceCalculation = useMemo(() => {
    if (!isDimensionValid) {
      return { area: 0, pricePerM2: storePricePerM2, total: 0 };
    }
    return computeCurtainPrice(
      widthValue,
      resolvedHeightValue,
      manualOrderForm.curtainType,
      { effectivePricePerM2: storePricePerM2 },
      panneauConfig
    );
  }, [
    widthValue,
    resolvedHeightValue,
    isDimensionValid,
    manualOrderForm.curtainType,
    storePricePerM2,
    panneauConfig,
  ]);

  // Same pricing as the client configurator (lib/order-pricing):
  // store unit = full opening (surface + spit addons); × quantity of openings.
  const computedItemTotalCost = useMemo(() => {
    if (!isQuantityValid) return 0;
    return getCurtainLineTotal(
      manualOrderForm.curtainType,
      priceCalculation.total,
      quantityValue
    );
  }, [
    priceCalculation.total,
    quantityValue,
    isQuantityValid,
    manualOrderForm.curtainType,
  ]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(price);

  const draftItemsTotal = useMemo(
    () => manualOrderItems.reduce((sum, item) => sum + item.totalCost, 0),
    [manualOrderItems]
  );

  const activeDeliveryFee = hasSelectedRegion
    ? Number(autoDeliveryFee) || 0
    : editingOrder
      ? editingOrder.deliveryFee
      : Number(autoDeliveryFee) || 0;

  const displayOrderTotal = useMemo(() => {
    return draftItemsTotal + (installationSelected ? installationFeeValue : 0);
  }, [draftItemsTotal, installationSelected, installationFeeValue]);

  const manualInvoiceTotals = useMemo(
    () =>
      calculateOrderInvoiceTotals({
        totalAmount: displayOrderTotal + activeDeliveryFee,
        deliveryFee: activeDeliveryFee,
        installationFee: installationSelected ? installationFeeValue : 0,
        customerInfo: { customerType: manualOrderForm.customerType },
      }),
    [
      displayOrderTotal,
      activeDeliveryFee,
      installationSelected,
      installationFeeValue,
      manualOrderForm.customerType,
    ]
  );

  const manualInvoiceLines = useMemo(
    () =>
      getOrderSummaryLines(manualInvoiceTotals, {
        regionSelected: Boolean(editingOrder) || hasSelectedRegion,
        isFreeDeliveryActive,
      }),
    [manualInvoiceTotals, editingOrder, hasSelectedRegion, isFreeDeliveryActive]
  );

  const storePanelMeasurements = useMemo(() => {
    if (
      manualOrderForm.curtainType !== "store" ||
      !isDimensionValid ||
      Number.isNaN(widthValue) ||
      Number.isNaN(resolvedHeightValue)
    ) {
      return [];
    }
    return getStorePanelMeasurements(widthValue, resolvedHeightValue);
  }, [
    manualOrderForm.curtainType,
    isDimensionValid,
    widthValue,
    resolvedHeightValue,
  ]);

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
        setEditingOrder(null);
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
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-charts-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  const handleInlineStatusUpdate = (orderId: string, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/admin/orders?id=${orderId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onMutate: async (orderId) => {
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
          applyOrderDeleteUpdate(oldData, orderId)
        );
      }
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderDeleteUpdate(oldData, orderId)
      );

      return { previousOrderQueries, previousOrderStatsQuery };
    },
    onSuccess: () => {
      setOrderToDelete(null);
      success("Commande supprimée.");
    },
    onError: (mutationError, _orderId, context) => {
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
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-charts-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  useEffect(() => {
    if (!orderToDelete) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteOrderMutation.isPending) {
        setOrderToDelete(null);
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [orderToDelete, deleteOrderMutation.isPending]);

  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete({ id: orderId, label: `#${orderId.slice(-8)}` });
  };

  const closeDeleteOrderModal = () => {
    if (deleteOrderMutation.isPending) {
      return;
    }
    setOrderToDelete(null);
  };

  const createOrderMutation = useMutation({
    mutationFn: async (payload: {
      customerInfo: {
        customerType: CustomerType;
        firstName?: string;
        lastName?: string;
        companyName?: string;
        matriculeFiscale?: string;
        email?: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
      };
      items: Array<{
        curtainTypeId: string;
        curtainTypeName: string;
        curtainType: CurtainType;
        width: number;
        height: number;
        quantity: number;
        totalCost: number;
      }>;
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

      const itemsTotal = payload.items.reduce((sum, item) => sum + item.totalCost, 0);
      const optimisticOrderId = `optimistic-${Date.now()}`;
      const optimisticOrder = {
        _id: optimisticOrderId,
        id: optimisticOrderId,
        status: "confirmed",
        totalAmount: Math.max(
          0,
          itemsTotal +
            payload.deliveryFee +
            (payload.wantsInstallation ? payload.installationFee : 0)
        ),
        createdAt: new Date().toISOString(),
        customerInfo: payload.customerInfo,
        userId: {
          name: session?.user?.name || "Admin",
          email: session?.user?.email || "",
        },
        items: payload.items.map((item) => ({
          curtainTypeId: item.curtainTypeId,
          curtainTypeName: item.curtainTypeName,
          curtainType: item.curtainType,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          totalCost: item.totalCost,
        })),
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
        customerType: "person",
        firstName: "",
        lastName: "",
        companyName: "",
        matriculeFiscale: "",
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
      setManualOrderItems([]);
      setEditingOrder(null);
      setHasSelectedManualReferenceByType({ panneau: false, store: false });
      setManualOrderError("");
      setManualEmailError("");
      setManualPhoneError("");
      setManualMatriculeFiscaleError("");
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
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-charts-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  const updateOrderItemsMutation = useMutation({
    mutationFn: async (payload: {
      orderId: string;
      customerInfo: {
        customerType: CustomerType;
        firstName?: string;
        lastName?: string;
        companyName?: string;
        matriculeFiscale?: string;
        email?: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
      };
      items: Array<{
        curtainTypeId: string;
        curtainTypeName: string;
        curtainType: CurtainType;
        width: number;
        height: number;
        quantity: number;
        totalCost: number;
      }>;
      wantsInstallation: boolean;
      deliveryFee: number;
      installationFee: number;
      notes?: string;
    }) => {
      const response = await fetch(`/api/admin/orders?id=${payload.orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerInfo: payload.customerInfo,
          items: payload.items,
          wantsInstallation: payload.wantsInstallation,
          deliveryFee: payload.deliveryFee,
          installationFee: payload.installationFee,
          notes: payload.notes,
        }),
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

      const itemsTotal = payload.items.reduce((sum, item) => sum + item.totalCost, 0);
      const installationFee = payload.wantsInstallation ? payload.installationFee : 0;
      const nextTotal = Math.max(0, itemsTotal + payload.deliveryFee + installationFee);
      const optimisticPatch = {
        items: payload.items,
        totalAmount: nextTotal,
        customerInfo: payload.customerInfo,
        wantsInstallation: payload.wantsInstallation,
        deliveryFee: payload.deliveryFee,
        installationFee,
        notes: payload.notes || "",
      };

      for (const [queryKey] of previousOrderQueries) {
        queryClient.setQueryData<AdminOrdersQueryData>(queryKey, (oldData) =>
          applyOrderItemsUpdate(
            oldData,
            payload.orderId,
            payload.items,
            nextTotal,
            optimisticPatch
          )
        );
      }
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderItemsUpdate(oldData, payload.orderId, payload.items, nextTotal, optimisticPatch)
      );

      return { previousOrderQueries, previousOrderStatsQuery };
    },
    onSuccess: (updatedOrder, variables) => {
      queryClient.setQueriesData<AdminOrdersQueryData>(
        { queryKey: ADMIN_ORDERS_LIST_QUERY_KEY },
        (oldData) =>
          applyOrderItemsUpdate(
            oldData,
            variables.orderId,
            updatedOrder.items || variables.items,
            updatedOrder.totalAmount,
            updatedOrder
          )
      );
      queryClient.setQueryData<AdminOrdersQueryData>(ADMIN_ORDERS_STATS_QUERY_KEY, (oldData) =>
        applyOrderItemsUpdate(
          oldData,
          variables.orderId,
          updatedOrder.items || variables.items,
          updatedOrder.totalAmount,
          updatedOrder
        )
      );

      setEditingOrder(null);
      setManualOrderItems([]);
      setManualOrderForm((prev) => ({
        ...prev,
        productId: "",
        width: "",
        height: "",
        quantity: "1",
      }));
      setHasSelectedManualReferenceByType({ panneau: false, store: false });
      setManualOrderError("");
      setIsManualOrderModalOpen(false);
      success("Commande mise à jour.");
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
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-charts-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notification-center-orders"] });
    },
  });

  const handleManualCustomerTypeChange = (customerType: CustomerType) => {
    setManualOrderForm((prev) => ({
      ...prev,
      customerType,
      ...(customerType === "person"
        ? { companyName: "", matriculeFiscale: "" }
        : { firstName: "", lastName: "" }),
    }));
    if (customerType === "person") {
      setManualMatriculeFiscaleError("");
    }
  };

  const resetManualProductFields = () => {
    setManualOrderForm((prev) => ({
      ...prev,
      productId: "",
      width: "",
      height: "",
      quantity: "1",
    }));
    setHasSelectedManualReferenceByType({ panneau: false, store: false });
  };

  const buildCurrentManualLine = (): ManualOrderLineItem | null => {
    const width = parseMeasurement(manualOrderForm.width);
    const height =
      manualOrderForm.curtainType === "panneau"
        ? panneauConfig.fixedHeightCm
        : parseMeasurement(manualOrderForm.height);
    const quantity = Number(manualOrderForm.quantity);
    const productName = selectedProductName;

    if (!productName) {
      setManualOrderError("Veuillez sélectionner une référence.");
      return null;
    }
    if (
      manualOrderForm.curtainType === "panneau" &&
      !panneauProducts.some((product) => product._id === manualOrderForm.productId)
    ) {
      setManualOrderError("Veuillez sélectionner une référence panneau autorisée.");
      return null;
    }
    if ([width, height, quantity].some((n) => Number.isNaN(n))) {
      setManualOrderError("Veuillez saisir des valeurs numériques valides.");
      return null;
    }
    if (width <= 0 || height <= 0) {
      setManualOrderError("Les dimensions doivent être supérieures à 0.");
      return null;
    }
    if (manualOrderForm.curtainType === "panneau" && !panneauWidthValues.has(width)) {
      setManualOrderError("Veuillez sélectionner une largeur panneau valide.");
      return null;
    }
    if (quantity <= 0) {
      setManualOrderError("La quantité doit être supérieure à 0.");
      return null;
    }
    if (!isQuantityValid || computedItemTotalCost < 0) {
      setManualOrderError("Impossible de calculer le prix de ce produit.");
      return null;
    }

    return {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      productId: manualOrderForm.productId,
      productName,
      curtainType: manualOrderForm.curtainType,
      width,
      height,
      quantity,
      totalCost: computedItemTotalCost,
    };
  };

  const handleAddManualProduct = () => {
    setManualOrderError("");
    if (manualOrderItems.length >= 20) {
      setManualOrderError("Trop de produits dans une commande (maximum 20).");
      return;
    }
    const line = buildCurrentManualLine();
    if (!line) {
      return;
    }
    setManualOrderItems((prev) => [...prev, line]);
    resetManualProductFields();
    success("Produit ajouté à la commande.");
  };

  const handleRemoveManualProduct = (lineId: string) => {
    setManualOrderItems((prev) => prev.filter((item) => item.id !== lineId));
  };

  const closeManualOrderModal = () => {
    if (createOrderMutation.isPending || updateOrderItemsMutation.isPending) {
      return;
    }
    setIsManualOrderModalOpen(false);
    setEditingOrder(null);
    setManualOrderError("");
  };

  const openEditOrder = (order: any) => {
    const lines = mapOrderItemsToManualLines(order.items);
    const info =
      order.customerInfo && typeof order.customerInfo === "object" ? order.customerInfo : {};
    const customerType = info.customerType === "company" ? "company" : "person";
    const readOptional = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : "";

    setEditingOrder({
      id: order._id,
      deliveryFee: Number(order.deliveryFee) || 0,
      installationFee: Number(order.installationFee) || 0,
      wantsInstallation: order.wantsInstallation === true,
    });
    setManualOrderItems(lines);
    setHasSelectedManualReferenceByType({ panneau: false, store: false });
    setManualOrderError("");
    setManualEmailError("");
    setManualPhoneError("");
    setManualMatriculeFiscaleError("");
    setManualOrderForm({
      customerType,
      firstName: readOptional(info.firstName),
      lastName: readOptional(info.lastName),
      companyName: readOptional(info.companyName),
      matriculeFiscale: formatMatriculeFiscale(
        readMatriculeFiscale(info as Record<string, unknown>)
      ),
      email: readOptional(info.email),
      phone: normalizePhoneValue(readOptional(info.phone)),
      address: readOptional(info.address),
      city: readOptional(info.city),
      state: readOptional(info.state),
      postalCode: readOptional(info.postalCode),
      productId: "",
      curtainType: "panneau",
      width: "",
      height: "",
      quantity: "1",
      deliveryFee: "",
      wantsInstallation: order.wantsInstallation === true,
      installationFee:
        typeof order.installationFee === "number"
          ? order.installationFee.toFixed(2)
          : typeof installationFeeData?.fee === "number"
            ? installationFeeData.fee.toFixed(2)
            : "11",
      notes: typeof order.notes === "string" ? order.notes : "",
    });
    setIsManualOrderModalOpen(true);
  };

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderError("");
    setManualEmailError("");
    setManualPhoneError("");
    setManualMatriculeFiscaleError("");

    let lines = manualOrderItems;
    if (lines.length === 0 && selectedProductName && isDimensionValid && isQuantityValid) {
      const line = buildCurrentManualLine();
      if (!line) {
        return;
      }
      lines = [line];
    }

    if (lines.length === 0) {
      setManualOrderError("Ajoutez au moins un produit à la commande.");
      return;
    }

    const payloadItems = lines.map((item) => ({
      curtainTypeId: item.productId,
      curtainTypeName: formatCurtainTypeName(item.productName, item.curtainType),
      curtainType: item.curtainType,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      totalCost: item.totalCost,
    }));

    const deliveryFee = activeDeliveryFee;
    const installationFee =
      typeof installationFeeData?.fee === "number"
        ? installationFeeData.fee
        : Number(manualOrderForm.installationFee);
    const normalizedEmail = normalizeEmailValue(manualOrderForm.email);
    const normalizedPhone = normalizePhoneValue(manualOrderForm.phone);
    const formattedMatriculeFiscale = formatMatriculeFiscale(manualOrderForm.matriculeFiscale);
    const emailValidationError = getEmailValidationError(normalizedEmail);
    const phoneValidationError = getPhoneValidationError(normalizedPhone, { required: true });
    const matriculeValidationError =
      manualOrderForm.customerType === "company" && formattedMatriculeFiscale
        ? getMatriculeFiscaleValidationError(formattedMatriculeFiscale)
        : "";

    setManualOrderForm((prev) => ({
      ...prev,
      email: normalizedEmail,
      phone: normalizedPhone,
      ...(prev.customerType === "company"
        ? { matriculeFiscale: formattedMatriculeFiscale }
        : {}),
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
    if (matriculeValidationError) {
      setManualMatriculeFiscaleError(matriculeValidationError);
      setManualOrderError(matriculeValidationError);
      return;
    }
    if (manualOrderForm.customerType === "person") {
      const firstName = manualOrderForm.firstName.trim();
      const lastName = manualOrderForm.lastName.trim();
      if (firstName && firstName.length < 2) {
        setManualOrderError("Le prénom doit contenir au moins 2 caractères.");
        return;
      }
      if (lastName && lastName.length < 2) {
        setManualOrderError("Le nom doit contenir au moins 2 caractères.");
        return;
      }
    } else {
      const companyName = manualOrderForm.companyName.trim();
      if (companyName && companyName.length < 2) {
        setManualOrderError("Le nom de l'entreprise doit contenir au moins 2 caractères.");
        return;
      }
    }

    const address = manualOrderForm.address.trim();
    if (address && address.length < 5) {
      setManualOrderError("L'adresse doit contenir au moins 5 caractères.");
      return;
    }
    const postalCode = manualOrderForm.postalCode.trim();
    if (postalCode && postalCode.length < 4) {
      setManualOrderError("Le code postal doit contenir au moins 4 caractères.");
      return;
    }

    if ([deliveryFee, installationFee].some((n) => Number.isNaN(n))) {
      setManualOrderError("Veuillez saisir des valeurs numériques valides.");
      return;
    }

    if (manualOrderForm.wantsInstallation === null) {
      setManualOrderError("Veuillez préciser si le client souhaite la pose.");
      return;
    }

    const customerInfo = {
      customerType: manualOrderForm.customerType,
      ...(manualOrderForm.customerType === "company"
        ? {
            companyName: manualOrderForm.companyName.trim(),
            matriculeFiscale: formattedMatriculeFiscale,
          }
        : {
            firstName: manualOrderForm.firstName.trim(),
            lastName: manualOrderForm.lastName.trim(),
          }),
      email: normalizedEmail,
      phone: normalizedPhone,
      address: manualOrderForm.address.trim(),
      city: manualOrderForm.city.trim(),
      state: manualOrderForm.state.trim(),
      postalCode: manualOrderForm.postalCode.trim(),
    };

    if (editingOrder) {
      updateOrderItemsMutation.mutate({
        orderId: editingOrder.id,
        customerInfo,
        items: payloadItems,
        wantsInstallation: manualOrderForm.wantsInstallation === true,
        deliveryFee,
        installationFee,
        notes: manualOrderForm.notes.trim(),
      });
      return;
    }

    createOrderMutation.mutate({
      customerInfo,
      items: payloadItems,
      wantsInstallation: manualOrderForm.wantsInstallation === true,
      deliveryFee,
      installationFee,
      notes: manualOrderForm.notes.trim(),
    });
  };

  const formatInvoiceDate = (value: string | Date) => {
    const date = new Date(value);
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    const day = date.getDate();
    const month = months[date.getMonth()] || "";
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const printInvoice = (order: any) => {
    const customer = parseCustomerInfo(order.customerInfo);
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const yearSuffix = String(new Date(order.createdAt || Date.now()).getFullYear()).slice(-2);
    const orderSeq = String(parseInt((order._id || "0").slice(-6), 16) % 1000 || 1).padStart(
      3,
      "0"
    );
    const invoiceNumber = `${orderSeq} / ${yearSuffix}`;
    const orderDate = formatInvoiceDate(order.createdAt);
    const invoiceTotals = calculateOrderInvoiceTotals(
      {
        totalAmount: order.totalAmount || 0,
        deliveryFee: order.deliveryFee || 0,
        installationFee: order.installationFee || 0,
        customerInfo: order.customerInfo,
      },
      // Admin facture only: particuliers get the same FODEC / H.T / TTC math as companies.
      { applyCompanyFiscalBreakdown: true }
    );

    const isCompanyInvoice = invoiceTotals.customerType === "company";
    const includePersonTax = !isCompanyInvoice;
    const printedLines = getPrintedInvoiceLines(invoiceTotals, { includePersonTax });
    const printedGrandTotal = getPrintedInvoiceGrandTotal(invoiceTotals, { includePersonTax });
    const customerName =
      isCompanyInvoice && customer.companyName && customer.companyName !== "N/A"
        ? customer.companyName
        : getCustomerDisplayName(order.customerInfo || {});
    const personNomPrenom = [customer.lastName, customer.firstName]
      .filter((part) => part && part !== "N/A")
      .join(" ")
      .trim();
    const customerAddress = [customer.address, customer.city, customer.state]
      .filter((part) => part && part !== "N/A")
      .join(", ");

    const totalCurtains = orderItems.reduce(
      (sum: number, item: any) => sum + Math.max(1, Number(item.quantity) || 1),
      0
    );
    const fournitureLabel =
      totalCurtains <= 0
        ? "Fourniture de rideaux bambou"
        : totalCurtains === 1
          ? "Fourniture d'un rideau bambou"
          : `Fourniture de ${totalCurtains} rideaux bambou`;

    const formatAmount = (value: number) =>
      value.toLocaleString("fr-FR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });

    // Always one TARIFS line: total qty + products HT (before FODEC).
    const productsHt = invoiceTotals.productsSubtotal;
    const itemsRows =
      totalCurtains > 0
        ? `
          <tr>
            <td class="qty">${escapeHtml(String(totalCurtains).padStart(2, "0"))}</td>
            <td>Rideaux Bambou</td>
            <td class="price">${escapeHtml(`${formatAmount(productsHt)} DT`)}</td>
          </tr>
        `
        : "";

    const clientBlock = isCompanyInvoice
      ? `<p><strong>STE :</strong> ${escapeHtml(customerName)}</p>
         <p>${escapeHtml(customerAddress || "—")}</p>
         <p><strong>M/F :</strong> ${escapeHtml(customer.matriculeFiscale)}</p>`
      : `<p><strong>Nom et prénom :</strong> ${escapeHtml(personNomPrenom || customerName)}</p>
         <p>${escapeHtml(customerAddress || "—")}</p>`;

    const totalsBlock = printedLines
      .map((line) => {
        const amount = escapeHtml(`${formatAmount(line.amount)} DT`);
        if (line.emphasis) {
          return `<p class="grand"><span>${escapeHtml(line.label)} :</span><span>${amount}</span></p>`;
        }
        return `<p><span>${escapeHtml(line.label)} :</span><span>${amount}</span></p>`;
      })
      .join("");

    const amountWords = escapeHtml(amountToFrenchWordsTnd(printedGrandTotal));

    const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Facture ${escapeHtml(invoiceNumber)}</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111;
        /* 5cm left for pre-printed orange band + logo */
        padding: 2.5cm 1.6cm 1.8cm 5cm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-size: 13px;
        line-height: 1.45;
      }
      .top-row {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 1.6cm;
      }
      .date {
        font-weight: 700;
        font-size: 14px;
      }
      .client-block {
        /* Center on the full page (body padding is uneven: 5cm left / 1.6cm right) */
        width: 100%;
        margin: 0 auto 1.4cm;
        text-align: center;
        line-height: 1.7;
        font-size: 14px;
        position: relative;
        left: calc((1.6cm - 5cm) / 2);
      }
      .client-block p {
        margin: 0 0 2px;
      }
      .meta {
        margin-bottom: 1.1cm;
      }
      .meta p {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 700;
      }
      .tariffs-title {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1.2cm;
      }
      th, td {
        border: 1px solid #111;
        padding: 8px 10px;
        font-size: 13px;
      }
      th {
        text-align: center;
        font-weight: 700;
      }
      td.qty {
        text-align: center;
        width: 14%;
      }
      td.price {
        text-align: right;
        width: 28%;
        white-space: nowrap;
      }
      .totals {
        width: 280px;
        margin-left: auto;
        margin-bottom: 1.4cm;
      }
      .totals p {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin: 5px 0;
        font-size: 13px;
      }
      .totals .grand {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #111;
        font-weight: 700;
        font-size: 14px;
      }
      .amount-words {
        margin-bottom: 0.35cm;
        font-size: 13px;
        line-height: 1.55;
      }
      .bank {
        margin-top: 0;
        margin-bottom: 1.25cm;
        font-size: 13px;
        font-weight: 700;
      }
      .signature {
        margin-top: 1cm;
        font-size: 14px;
        font-weight: 700;
      }
      @media print {
        body {
          padding: 2.5cm 1.6cm 1.8cm 5cm;
        }
      }
    </style>
  </head>
  <body>
    <div class="top-row">
      <div class="date">Tunis le : ${escapeHtml(orderDate)}</div>
    </div>

    <section class="client-block">
      ${clientBlock}
    </section>

    <section class="meta">
      <p>Facture : ${escapeHtml(invoiceNumber)}</p>
      <p>${escapeHtml(fournitureLabel)}</p>
    </section>

    <p class="tariffs-title">TARIFS</p>
    <table>
      <thead>
        <tr>
          <th>Qte</th>
          <th>Désignations</th>
          <th>Prix H.T</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || `<tr><td class="qty">—</td><td>Aucun article</td><td class="price">—</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      ${totalsBlock}
    </div>

    <p class="amount-words">
      Arrêter la présente facture à la somme de : ${amountWords}
    </p>

    <p class="bank">Pour Tout Virement : ATB la Marsa : 01 005 0341105008072 83</p>

    <p class="signature">Gérant :</p>
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

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content="Manage Orders - Rideaux Bambou Admin" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl overflow-x-clip px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-4 sm:mb-6">
            <BackButton href="/admin" />
          </div>
          <div className="space-y-5 sm:space-y-6">
            {/* Header */}
            <div>
              <div className="mb-4 flex items-center justify-between gap-2 sm:mb-10 sm:gap-3 lg:mb-14">
                <h1 className="min-w-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  Gestion des Commandes
                </h1>
                <Button
                  type="button"
                  size="sm"
                  icon={<FiPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  onClick={() => {
                    setEditingOrder(null);
                    setHasSelectedManualReferenceByType({ panneau: false, store: false });
                    setManualOrderItems([]);
                    setManualOrderError("");
                    setManualOrderForm((prev) => ({
                      ...prev,
                      productId: "",
                      width: "",
                      height: "",
                      quantity: "1",
                      wantsInstallation: null,
                      installationFee:
                        typeof installationFeeData?.fee === "number"
                          ? installationFeeData.fee.toFixed(2)
                          : prev.installationFee,
                    }));
                    setIsManualOrderModalOpen(true);
                  }}
                  className="shrink-0 !inline-flex !items-center !leading-none rounded-lg px-2.5 py-1.5 text-xs shadow-md sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm sm:shadow-lg"
                >
                  <span className="sm:hidden">Ajouter</span>
                  <span className="hidden sm:inline">Ajouter une commande</span>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:flex md:items-end md:justify-between md:gap-4">
                <div className="min-w-0 md:w-full md:max-w-sm">
                  <Input
                    label="Rechercher une commande"
                    placeholder="ID, client ou téléphone"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setFocusOrderLookup(null);
                      setCurrentPage(1);
                    }}
                    icon={<FiSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    className="!rounded-lg !py-2 !text-sm sm:!rounded-md"
                  />
                </div>
                <div
                  className="inline-flex flex-col items-stretch justify-self-start self-start md:!w-[9.84rem] md:!max-w-[9.84rem] md:justify-self-auto md:self-end"
                  style={{ width: "8.76rem", maxWidth: "8.76rem" }}
                >
                  <label className="mb-1 block w-full text-left text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-400 sm:text-sm sm:text-gray-700 dark:sm:text-gray-300">
                    Filtrer par statut
                  </label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                    className={`${formSelectClass} !box-border !h-8 !w-full !max-w-full !rounded-lg !px-2.5 !py-1 !text-xs !leading-tight sm:!h-auto sm:!rounded-md sm:!px-3 sm:!py-2 sm:!text-sm`}
                    style={{ width: "100%", maxWidth: "100%" }}
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
              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
                {[
                  {
                    key: "pending",
                    value: ordersData.stats.pendingOrders,
                    label: "Attente",
                    labelFull: "En Attente",
                    accent: "border-t-yellow-500",
                    valueClass: "text-yellow-600 dark:text-yellow-400",
                    soft: "bg-yellow-50/70 dark:bg-yellow-950/20",
                  },
                  {
                    key: "confirmed",
                    value: ordersData.stats.confirmedOrders || 0,
                    label: "Confirmées",
                    labelFull: "Confirmées",
                    accent: "border-t-blue-500",
                    valueClass: "text-blue-600 dark:text-blue-400",
                    soft: "bg-blue-50/70 dark:bg-blue-950/20",
                  },
                  {
                    key: "processing",
                    value: ordersData.stats.processingOrders || 0,
                    label: "En cours",
                    labelFull: "En cours",
                    accent: "border-t-purple-500",
                    valueClass: "text-purple-600 dark:text-purple-400",
                    soft: "bg-purple-50/70 dark:bg-purple-950/20",
                  },
                  {
                    key: "delivered",
                    value: ordersData.stats.deliveredOrders,
                    label: "Livrées",
                    labelFull: "Livrées",
                    accent: "border-t-green-500",
                    valueClass: "text-green-600 dark:text-green-400",
                    soft: "bg-green-50/70 dark:bg-green-950/20",
                  },
                  {
                    key: "cancelled",
                    value: ordersData.stats.cancelledOrders || 0,
                    label: "Annulées",
                    labelFull: "Annulées",
                    accent: "border-t-red-500",
                    valueClass: "text-red-600 dark:text-red-400",
                    soft: "bg-red-50/70 dark:bg-red-950/20",
                  },
                ].map((stat) => (
                  <div
                    key={stat.key}
                    className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border border-gray-200/80 border-t-[3px] ${stat.accent} ${stat.soft} px-1.5 py-2.5 text-center shadow-sm dark:border-gray-700/70 sm:min-h-[5.5rem] sm:rounded-2xl sm:px-3 sm:py-3.5`}
                  >
                    <p
                      className={`flex h-7 items-baseline justify-center text-lg font-bold leading-none tracking-tight sm:h-9 sm:text-2xl ${stat.valueClass}`}
                    >
                      {stat.value}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-gray-600 dark:text-gray-300 sm:mt-1.5 sm:text-xs">
                      <span className="sm:hidden">{stat.label}</span>
                      <span className="hidden sm:inline">{stat.labelFull}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {isManualOrderModalOpen && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-3 py-6"
                onClick={closeManualOrderModal}
              >
                <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl">
                  <Card className="max-h-[95vh] w-full overflow-y-auto overscroll-contain p-4 sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {editingOrder
                            ? `Modifier la commande #${editingOrder.id.slice(-8)}`
                            : "Ajouter une commande"}
                  </h3>
                      </div>
                      <button
                        type="button"
                        onClick={closeManualOrderModal}
                        disabled={
                          createOrderMutation.isPending || updateOrderItemsMutation.isPending
                        }
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
                              disabled={isProductsLoading || selectableManualProducts.length === 0}
                            >
                              {!hasSelectedManualReferenceForCurrentType &&
                                manualOrderForm.productId === "" && (
                                <option value="" className="text-gray-400">
                                  Choisir la référence
                                </option>
                              )}
                              {selectableManualProducts.map((product) => (
                                <option
                                  key={product._id}
                                  value={product._id}
                                  disabled={product.isAvailable === false}
                                >
                                  {product.name}
                                  {product.isAvailable === false ? " — rupture de stock" : ""}
                                </option>
                              ))}
                            </select>
                            {manualOrderForm.curtainType === "panneau" &&
                              panneauProducts.length > 0 &&
                              panneauProducts.length < products.length && (
                              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                Références disponibles en panneau :{" "}
                                {panneauProducts.map((product) => product.name).join(", ")}
                              </p>
                            )}
                            {selectableManualProducts.length === 0 && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {manualOrderForm.curtainType === "panneau"
                                  ? "Aucune référence panneau configurée."
                                  : "Aucune référence active disponible."}
                              </p>
                            )}
                            {manualOrderForm.curtainType === "panneau" &&
                              selectableManualProducts.length > 0 &&
                              selectableManualProducts.every((product) => product.isAvailable === false) && (
                              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                Toutes les références panneau sont en rupture de stock.
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
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      curtainType: "panneau",
                                      quantity: "1",
                                    }))
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
                                  type="text"
                                  inputMode="decimal"
                                  value={manualOrderForm.width}
                                  onChange={(e) => {
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      width: sanitizeMeasurementInput(e.target.value),
                                    }));
                                  }}
                                  placeholder="ex. 120,5"
                                  className={formNumberFieldClass}
                                />
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
                                  type="text"
                                  inputMode="decimal"
                                  value={manualOrderForm.height}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      height: sanitizeMeasurementInput(e.target.value),
                                    }))
                                  }
                                  placeholder="ex. 200"
                                  className={formNumberFieldClass}
                                />
                              )}
                            </div>
                          </div>

                          <div>
                            <label className={formFieldLabelClass}>Pose</label>
                            <div className="flex flex-wrap gap-4">
                              {([true, false] as const).map((wantsPose) => (
                                <label
                                  key={wantsPose ? "oui" : "non"}
                                  className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                                >
                                  <input
                                    type="radio"
                                    name="manual-installation"
                                    checked={manualOrderForm.wantsInstallation === wantsPose}
                                    onChange={() =>
                                      setManualOrderForm((prev) => ({
                                        ...prev,
                                        wantsInstallation: wantsPose,
                                      }))
                                    }
                                    className="sr-only"
                                  />
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                    <span
                                      className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                        manualOrderForm.wantsInstallation === wantsPose
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                  </span>
                                  <span className="text-sm">{wantsPose ? "Oui" : "Non"}</span>
                                </label>
                              ))}
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
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {manualOrderForm.curtainType === "store" &&
                            storePanelMeasurements.length > 0 && (
                              <StorePanelBreakdown
                                panels={storePanelMeasurements}
                                compact
                              />
                            )}

                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleAddManualProduct}
                              disabled={
                                !selectedProductName ||
                                !isDimensionValid ||
                                !isQuantityValid ||
                                manualOrderItems.length >= 20
                              }
                            >
                              Ajouter ce produit
                            </Button>
                          </div>

                          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                              Résumé de la commande
                            </h4>
                            <div className="space-y-3">
                              {manualOrderItems.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Aucun produit ajouté pour le moment.
                                </p>
                              ) : (
                                manualOrderItems.map((item) => (
                                  <div
                                    key={`summary-${item.id}`}
                                    className="flex items-start justify-between gap-3 text-sm"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {item.productName}
                                      </p>
                                      <p className="text-gray-500 dark:text-gray-400">
                                        {item.width}cm × {item.height}cm ·{" "}
                                        {item.curtainType === "panneau" ? "Panneau" : "Store"} · Qté{" "}
                                        {item.quantity}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <span className="text-gray-900 dark:text-white">
                                        {formatPrice(item.totalCost)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveManualProduct(item.id)}
                                        className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                                        aria-label="Retirer ce produit"
                                      >
                                        <FiTrash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}

                              <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                                <div className="space-y-2 text-sm">
                                  {manualInvoiceLines.map((line) => (
                                    <div
                                      key={line.label}
                                      className={`flex justify-between ${
                                        line.emphasis
                                          ? "border-t border-gray-200 pt-3 text-lg font-semibold dark:border-gray-700"
                                          : "text-gray-600 dark:text-gray-400"
                                      }`}
                                    >
                                      <span
                                        className={
                                          line.emphasis
                                            ? "text-gray-900 dark:text-white"
                                            : undefined
                                        }
                                      >
                                        {line.label}
                                      </span>
                                      <span className="text-gray-900 dark:text-white">
                                        {line.displayText ?? formatPrice(line.amount)}
                                      </span>
                  </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Informations client
                          </h4>
                          <div>
                            <label className={formFieldLabelClass}>Type de client</label>
                            <div className="flex flex-wrap gap-4">
                              {(["person", "company"] as const).map((type) => (
                                <label
                                  key={type}
                                  className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                                >
                                  <input
                                    type="radio"
                                    name="manualCustomerType"
                                    value={type}
                                    checked={manualOrderForm.customerType === type}
                                    onChange={() => handleManualCustomerTypeChange(type)}
                                    className="sr-only"
                                  />
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                                    <span
                                      className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                        manualOrderForm.customerType === type
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                  </span>
                                  <span className="text-sm">{CUSTOMER_TYPE_LABELS[type]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          {isManualCompanyOrder ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <label className={formFieldLabelClass}>
                                  Nom de l&apos;entreprise (optionnel)
                                </label>
                                <input
                                  type="text"
                                  value={manualOrderForm.companyName}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      companyName: e.target.value,
                                    }))
                                  }
                                  className={formFieldClass}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className={formFieldLabelClass}>
                                  Matricule fiscale (optionnel)
                                </label>
                                <input
                                  type="text"
                                  value={manualOrderForm.matriculeFiscale}
                                  onChange={(e) => {
                                    const nextMatricule = applyMatriculeFiscaleInput(
                                      manualOrderForm.matriculeFiscale,
                                      e.target.value
                                    );
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      matriculeFiscale: nextMatricule,
                                    }));
                                    if (manualMatriculeFiscaleError) {
                                      const normalized = formatMatriculeFiscale(nextMatricule);
                                      setManualMatriculeFiscaleError(
                                        normalized
                                          ? getMatriculeFiscaleValidationError(nextMatricule)
                                          : ""
                                      );
                                    }
                                  }}
                                  onBlur={() => {
                                    const normalized = formatMatriculeFiscale(
                                      manualOrderForm.matriculeFiscale
                                    );
                                    setManualMatriculeFiscaleError(
                                      normalized
                                        ? getMatriculeFiscaleValidationError(
                                            manualOrderForm.matriculeFiscale
                                          )
                                        : ""
                                    );
                                  }}
                                  placeholder={MATRICULE_FISCALE_FORMAT}
                                  maxLength={17}
                                  autoComplete="off"
                                  inputMode="text"
                                  className={`${formFieldClass} ${
                                    manualMatriculeFiscaleError ? formFieldErrorClass : ""
                                  }`}
                                />
                                {manualMatriculeFiscaleError && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {manualMatriculeFiscaleError}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label className={formFieldLabelClass}>Prénom (optionnel)</label>
                                <input
                                  type="text"
                                  value={manualOrderForm.firstName}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      firstName: e.target.value,
                                    }))
                                  }
                                  className={formFieldClass}
                                />
                              </div>
                              <div>
                                <label className={formFieldLabelClass}>Nom (optionnel)</label>
                                <input
                                  type="text"
                                  value={manualOrderForm.lastName}
                                  onChange={(e) =>
                                    setManualOrderForm((prev) => ({
                                      ...prev,
                                      lastName: e.target.value,
                                    }))
                                  }
                                  className={formFieldClass}
                                />
                              </div>
                            </div>
                          )}
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
                            <label className={formFieldLabelClass}>Adresse (optionnel)</label>
                            <input
                              type="text"
                              value={manualOrderForm.address}
                              onChange={(e) =>
                                setManualOrderForm((prev) => ({ ...prev, address: e.target.value }))
                              }
                              className={formFieldClass}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className={formFieldLabelClass}>Région (optionnel)</label>
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
                              <label className={formFieldLabelClass}>Ville (optionnel)</label>
                              <select
                                value={manualOrderForm.city}
                                onChange={(e) =>
                                  setManualOrderForm((prev) => ({ ...prev, city: e.target.value }))
                                }
                                disabled={!manualOrderForm.state}
                                className={formSelectDisabledClass}
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
                            <label className={formFieldLabelClass}>Code postal (optionnel)</label>
                            <input
                              type="text"
                              value={manualOrderForm.postalCode}
                              onChange={(e) =>
                                setManualOrderForm((prev) => ({ ...prev, postalCode: e.target.value }))
                              }
                              className={formFieldClass}
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
                          loading={
                            createOrderMutation.isPending || updateOrderItemsMutation.isPending
                          }
                          disabled={
                            createOrderMutation.isPending ||
                            updateOrderItemsMutation.isPending ||
                            Boolean(manualEmailError) ||
                            Boolean(manualPhoneError) ||
                            Boolean(manualMatriculeFiscaleError) ||
                            (Boolean(editingOrder) && manualOrderItems.length === 0)
                          }
                          className="w-full sm:w-auto"
                        >
                          {editingOrder
                            ? updateOrderItemsMutation.isPending
                              ? "Enregistrement..."
                              : "Enregistrer"
                            : createOrderMutation.isPending
                              ? "Création..."
                              : "Créer la commande"}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </div>
              </div>
            )}

            {/* Orders Table */}
            <div className="mx-auto w-full max-w-full overflow-visible rounded-lg bg-white shadow-lg dark:bg-gray-800 md:w-full">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Chargement des commandes...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 overflow-visible p-2.5 md:hidden">
                    {ordersData?.orders?.map((order: any) => {
                      const customer = parseCustomerInfo(order.customerInfo);
                      const displayTotal = getOrderDisplayTotal({
                        totalAmount: order.totalAmount || 0,
                        deliveryFee: order.deliveryFee || 0,
                        installationFee: order.installationFee || 0,
                        customerInfo: order.customerInfo,
                      });
                      const normalizedStatus = normalizeStatus(order.status);
                      return (
                      <div
                        key={`${order._id}-mobile`}
                        id={`admin-order-${order._id}`}
                        className={`rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${getFocusedOrderClass(order._id)}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/90 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/60">
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              #{order._id.slice(-8)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <select
                            value={normalizedStatus}
                            onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                            disabled={updateStatusMutation.isPending}
                            aria-label="Modifier le statut"
                            className={`compact-select inline-flex max-w-full shrink-0 cursor-pointer appearance-none whitespace-normal rounded-full border-0 px-2.5 py-1 pr-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-gray-400/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                              statusColors[normalizedStatus] ||
                              "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 0.4rem center",
                              backgroundSize: "0.9rem",
                            }}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-3 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 basis-[12rem] space-y-2">
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Client
                                </p>
                                <p className="mt-0.5 break-words text-sm font-medium text-gray-900 dark:text-white">
                                  {customer.name}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Téléphone
                                </p>
                                <p className="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                                  {customer.phone}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex max-w-full shrink-0 whitespace-normal rounded-full px-2.5 py-1 text-xs font-semibold ${
                                customerTypeBadgeClass[
                                  customer.customerType === "company" ? "company" : "person"
                                ]
                              }`}
                            >
                              {customer.customerTypeLabel}
                            </span>
                          </div>

                          {customer.customerType === "company" ? (
                            <p className="-mt-1 break-words text-xs text-gray-500 dark:text-gray-400">
                              MF {customer.matriculeFiscale}
                            </p>
                          ) : null}

                          <div className="grid grid-cols-1 gap-2.5 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/50">
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Produit
                              </p>
                              <div className="mt-0.5 space-y-1.5">
                                {(order.items || []).length > 0 ? (
                                  (order.items || []).map((item: any, index: number) => (
                                    <div
                                      key={`${order._id}-mobile-product-${index}`}
                                      className="break-words text-sm text-gray-900 dark:text-white"
                                    >
                                      <p className="font-medium">
                                        {normalizeCurtainTypeName(item.curtainTypeName) || "N/A"}
                                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Largeur {item.width} cm · Hauteur {item.height} cm
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-900 dark:text-white">N/A</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Total
                                </p>
                                <p className="mt-0.5 break-words text-sm font-semibold text-gray-900 dark:text-white">
                                  {displayTotal.toFixed(2)} TND
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Pose
                                </p>
                                <span
                                  className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    order.wantsInstallation
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {order.wantsInstallation ? "Oui" : "Non"}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Adresse
                              </p>
                              <p className="mt-0.5 break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                {customer.address || "N/A"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Gouvernorat
                                </p>
                                <p className="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                                  {customer.state || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Ville
                                </p>
                                <p className="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                                  {customer.city || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Code postal
                                </p>
                                <p className="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                                  {customer.postalCode || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Email
                                </p>
                                <p className="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-300">
                                  {customer.email || "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-start gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                              onClick={() => printInvoice(order)}
                            >
                              Imprimer
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                              onClick={() => openEditOrder(order)}
                            >
                              Modifier
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              className="box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                              disabled={deleteOrderMutation.isPending}
                              loading={deleteOrderMutation.isPending}
                              onClick={() => handleDeleteOrder(order._id)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                  <div className="hidden w-full overflow-x-auto md:block">
                    <table className="min-w-max w-full table-auto divide-y divide-gray-200 [&_td]:align-middle [&_th]:font-semibold [&_th]:tracking-wide dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className={orderTableHeadClass}>ID Commande</th>
                        <th className={orderTableHeadClass}>Client</th>
                        <th className={orderTableHeadClass}>Type client</th>
                        <th className={orderTableHeadClass}>Téléphone</th>
                        <th className={orderTableHeadClass}>Produit</th>
                        <th className={orderTableHeadClass}>Dimensions</th>
                        <th className={orderTableHeadClass}>Total</th>
                        <th className={orderTableHeadClass}>Pose</th>
                        <th className={orderTableHeadClass}>Adresse</th>
                        <th className={orderTableHeadClass}>Gouvernorat</th>
                        <th className={orderTableHeadClass}>Ville</th>
                        <th className={orderTableHeadClass}>Code postal</th>
                        <th className={orderTableHeadClass}>Email</th>
                        <th className={orderTableHeadClass}>Date</th>
                        <th className={orderTableHeadClass}>Facture</th>
                        <th className={orderTableHeadClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {ordersData?.orders?.map((order: any) => {
                        const customer = parseCustomerInfo(order.customerInfo);
                        const displayTotal = getOrderDisplayTotal({
                          totalAmount: order.totalAmount || 0,
                          deliveryFee: order.deliveryFee || 0,
                          installationFee: order.installationFee || 0,
                          customerInfo: order.customerInfo,
                        });
                        return (
                        <tr
                          key={order._id}
                          id={`admin-order-${order._id}`}
                          className={getFocusedOrderClass(order._id)}
                        >
                          <td className={orderTableCellClass}>
                            <div className="inline-flex flex-col items-center gap-1.5">
                              <span className="font-mono">#{order._id.slice(-8)}</span>
                              <select
                                value={normalizeStatus(order.status)}
                                onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                                disabled={updateStatusMutation.isPending}
                                aria-label="Modifier le statut"
                                className={`compact-select inline-flex max-w-full shrink-0 cursor-pointer appearance-none whitespace-normal rounded-full border-0 px-2.5 py-1 pr-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-gray-400/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                                  statusColors[normalizeStatus(order.status)] ||
                                  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                  backgroundRepeat: "no-repeat",
                                  backgroundPosition: "right 0.4rem center",
                                  backgroundSize: "0.9rem",
                                  transform: "scaleX(0.9)",
                                  transformOrigin: "center center",
                                }}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className={orderTableCellClass}>{customer.name}</td>
                          <td className={orderTableCellClass}>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                customerTypeBadgeClass[
                                  customer.customerType === "company" ? "company" : "person"
                                ]
                              }`}
                            >
                              {customer.customerTypeLabel}
                            </span>
                          </td>
                          <td className={orderTableCellClass}>{customer.phone}</td>
                          <td className={orderTableCellClass}>
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-product-${index}`}>
                                  {normalizeCurtainTypeName(item.curtainTypeName)}
                              </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                              </div>
                          </td>
                          <td className={`${orderTableCellClass} text-gray-500 dark:text-gray-400`}>
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-dimension-${index}`}>
                                  Largeur {item.width} cm · Hauteur {item.height} cm
                                </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                            </div>
                          </td>
                          <td className={`${orderTableCellClass} font-medium`}>
                            {displayTotal.toFixed(2)} TND
                          </td>
                          <td className={orderTableCellClass}>
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
                          <td className={`${orderTableAddressCellClass} whitespace-normal`}>
                            {customer.address}
                          </td>
                          <td className={orderTableCellClass}>{customer.state}</td>
                          <td className={orderTableCellClass}>{customer.city}</td>
                          <td className={orderTableCellClass}>{customer.postalCode}</td>
                          <td className={orderTableCellClass}>{customer.email}</td>
                          <td className={`${orderTableCellClass} text-gray-500 dark:text-gray-400`}>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className={orderTableCellClass}>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="!h-[2.125rem] !px-3 !py-0 !text-xs !leading-none sm:!h-9 sm:!px-4 sm:!text-sm"
                              onClick={() => printInvoice(order)}
                            >
                              Imprimer
                            </Button>
                          </td>
                          <td className={orderTableCellClass}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="!h-[2.125rem] !px-3 !py-0 !text-xs !leading-none sm:!h-9 sm:!px-4 sm:!text-sm"
                                onClick={() => openEditOrder(order)}
                            >
                              Modifier
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                className="!h-[2.125rem] !px-3 !py-0 !text-xs !leading-none sm:!h-9 sm:!px-4 sm:!text-sm"
                                disabled={deleteOrderMutation.isPending}
                                loading={deleteOrderMutation.isPending}
                                onClick={() => handleDeleteOrder(order._id)}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              {/* Pagination */}
              {ordersData?.pagination && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                  <div className="flex flex-1 justify-between gap-3 sm:hidden">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="min-w-[7.5rem] justify-center"
                    >
                      Précédent
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCurrentPage(
                          Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                        )
                      }
                      disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                      className="min-w-[7.5rem] justify-center"
                    >
                      Suivant
                    </Button>
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
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                        className="min-w-[7.5rem] justify-center font-semibold"
                        >
                          Précédent
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                          onClick={() =>
                            setCurrentPage(
                              Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                            )
                          }
                          disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                        className="min-w-[7.5rem] justify-center font-semibold"
                        >
                          Suivant
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {orderToDelete && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
              onClick={closeDeleteOrderModal}
              aria-label="Fermer la confirmation"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-order-confirm-title"
              className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <h3
                id="delete-order-confirm-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Supprimer la commande {orderToDelete.label} ?
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Cette action est irréversible. La commande sera définitivement retirée de la
                liste.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeDeleteOrderModal}
                  disabled={deleteOrderMutation.isPending}
                  >
                    Annuler
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={deleteOrderMutation.isPending}
                  disabled={deleteOrderMutation.isPending}
                  onClick={() => deleteOrderMutation.mutate(orderToDelete.id)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </>
  );
}


export { requireAdminPage as getServerSideProps } from "../../lib/require-admin-page";

