import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

import AdminNavigation from "../components/AdminNavigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Loading from "../components/ui/Loading";
import PriceDisplay from "../components/ui/PriceDisplay";
import { useToast } from "../contexts/ToastContext";
import {
  formatPanneauCardLabel,
  getEffectivePanneauWidthPrice,
  type PanneauConfig,
  type PanneauWidthConfig,
} from "../lib/panneau-types";
import {
  adminTableBodyClassName,
  adminTableHeadTextClassName,
  adminTableHeaderClassName,
} from "../components/ui/Table";
import { notifyPriceSettingsUpdated, buildStorePriceSyncPayload } from "../lib/price-sync";
import { formFieldClass } from "../lib/form-field-styles";
import { notifyProductsUpdated } from "../lib/product-availability-sync";
import { PRODUCTS_QUERY_KEY } from "../lib/products-query";

const PAGE_TITLE = "Tableau de Bord Admin - Rideaux Bambou";

const DashboardCharts = dynamic(() => import("../components/admin/DashboardCharts"), {
  loading: () => <div className="p-4 text-center">Chargement des graphiques...</div>,
});

type PanneauPromoDrafts = Record<string, string>;

const emptyPanneauPromoDrafts = (
  widths: Array<{ widthCm: number }>
): PanneauPromoDrafts =>
  Object.fromEntries(widths.map((width) => [String(width.widthCm), ""]));

const mapWidthsToPromoDrafts = (
  widths: Array<{ widthCm: number; salePrice?: number | null }>
): PanneauPromoDrafts =>
  Object.fromEntries(
    widths.map((width) => [
      String(width.widthCm),
      typeof width.salePrice === "number"
        ? Number(width.salePrice.toFixed(2)).toString()
        : "",
    ])
  );

interface AdminProduct {
  _id: string;
  name: string;
  supportsPanneau?: boolean;
  isActive?: boolean;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newPrice, setNewPrice] = useState("");
  const [newSalePrice, setNewSalePrice] = useState("");
  const [isSaleActive, setIsSaleActive] = useState(false);
  const [isPanneauSaleActive, setIsPanneauSaleActive] = useState(false);
  const [fixedPanneauHeight, setFixedPanneauHeight] = useState("");
  const [panneauPromoDrafts, setPanneauPromoDrafts] = useState<PanneauPromoDrafts>({});
  const [editingPanneauWidthCm, setEditingPanneauWidthCm] = useState<number | null>(null);
  const [editPanneauWidthCm, setEditPanneauWidthCm] = useState("");
  const [editPanneauWidthPrice, setEditPanneauWidthPrice] = useState("");
  const [newPanneauWidthCm, setNewPanneauWidthCm] = useState("");
  const [newPanneauWidthPrice, setNewPanneauWidthPrice] = useState("");
  const [isAddingPanneauWidth, setIsAddingPanneauWidth] = useState(false);
  const [newInstallationFee, setNewInstallationFee] = useState("");
  const { success, error, warning } = useToast();
  const pricesHydrated = useRef(false);
  const installationFeeHydrated = useRef(false);
  const panneauConfigHydrated = useRef(false);

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/connexion");
    }
  }, [session, status, router]);

  // Fetch current price
  const { data: priceData, isPending: priceInitialLoading } = useQuery({
    queryKey: ["admin-price"],
    queryFn: async () => {
      const response = await fetch("/api/admin/price");
      const data = await response.json();
      return data.data;
    },
    staleTime: 0,
  });

  const pushPriceUpdates = (
    updatedPrice: {
      pricePerM2: number;
      salePricePerM2?: number | null;
      isSaleActive?: boolean;
      effectivePricePerM2?: number;
      lastUpdated?: string;
      panneauPrice100cm?: number;
      panneauPrice130cm?: number;
    },
    panneauConfig?: PanneauConfig
  ) => {
    const storePrice = buildStorePriceSyncPayload(updatedPrice);
    queryClient.setQueryData(["global-price-home"], (current: Record<string, unknown> | undefined) => ({
      ...(current || {}),
      ...updatedPrice,
      ...storePrice,
    }));
    queryClient.setQueryData(["global-price"], (current: Record<string, unknown> | undefined) => ({
      ...(current || {}),
      ...updatedPrice,
      ...storePrice,
    }));
    notifyPriceSettingsUpdated({
      storePrice,
      panneauConfig: panneauConfig ?? undefined,
    });
  };

  useEffect(() => {
    if (!priceData || pricesHydrated.current) {
      return;
    }

    pricesHydrated.current = true;
    setNewPrice(
      typeof priceData.pricePerM2 === "number" ? priceData.pricePerM2.toString() : ""
    );
    setIsSaleActive(Boolean(priceData.isSaleActive));
    setNewSalePrice(
      typeof priceData.salePricePerM2 === "number"
        ? Number(priceData.salePricePerM2.toFixed(2)).toString()
        : ""
    );
  }, [priceData]);

  const { data: panneauConfigData, isPending: panneauConfigInitialLoading } = useQuery({
    queryKey: ["admin-panneau-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/panneau-config");
      const data = await response.json();
      return data.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!panneauConfigData || panneauConfigHydrated.current) {
      return;
    }

    panneauConfigHydrated.current = true;
    setIsPanneauSaleActive(Boolean(panneauConfigData.isSaleActive));
    setFixedPanneauHeight(
      typeof panneauConfigData.fixedHeightCm === "number"
        ? panneauConfigData.fixedHeightCm.toString()
        : ""
    );
    const widths = Array.isArray(panneauConfigData.widths) ? panneauConfigData.widths : [];
    // Like m²: only show saved promo values when the sale is active.
    setPanneauPromoDrafts(
      panneauConfigData.isSaleActive === true
        ? mapWidthsToPromoDrafts(widths)
        : emptyPanneauPromoDrafts(widths)
    );
  }, [panneauConfigData]);

  const { data: adminProducts = [], isPending: adminProductsLoading } = useQuery<AdminProduct[]>({
    queryKey: ["admin-products-panneau"],
    queryFn: async () => {
      const response = await fetch("/api/admin/products");
      const data = await response.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    },
    staleTime: 30_000,
  });

  const activeProducts = adminProducts.filter((product) => product.isActive !== false);

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async (price: number) => {
      const response = await fetch("/api/admin/price", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pricePerM2: price }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: (updatedPrice) => {
      queryClient.setQueryData(["admin-price"], updatedPrice);
      pushPriceUpdates(updatedPrice);
      success("Prix mis à jour avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const updateSaleMutation = useMutation({
    mutationFn: async ({
      salePricePerM2,
      isSaleActive: nextSaleActive,
    }: {
      salePricePerM2: number | null;
      isSaleActive: boolean;
    }) => {
      const response = await fetch("/api/admin/price", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ salePricePerM2, isSaleActive: nextSaleActive }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: (updatedPrice) => {
      queryClient.setQueryData(["admin-price"], updatedPrice);
      setIsSaleActive(Boolean(updatedPrice.isSaleActive));
      setNewSalePrice(
        typeof updatedPrice.salePricePerM2 === "number"
          ? Number(updatedPrice.salePricePerM2.toFixed(2)).toString()
          : ""
      );
      pushPriceUpdates(updatedPrice);
      success(
        updatedPrice.isSaleActive
          ? "Promotion mise à jour avec succès."
          : "Promotion désactivée. Le prix catalogue est de nouveau affiché."
      );
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const applyPanneauConfigUpdate = (
    updatedConfig: PanneauConfig,
    successMessage: string
  ) => {
    queryClient.setQueryData(["admin-panneau-config"], updatedConfig);
    setFixedPanneauHeight(
      typeof updatedConfig.fixedHeightCm === "number"
        ? updatedConfig.fixedHeightCm.toString()
        : ""
    );
    const widths = Array.isArray(updatedConfig.widths) ? updatedConfig.widths : [];
    setPanneauPromoDrafts((previous) => {
      const next: PanneauPromoDrafts = {};
      for (const width of widths) {
        const key = String(width.widthCm);
        next[key] = Object.prototype.hasOwnProperty.call(previous, key) ? previous[key] : "";
      }
      return next;
    });
    const currentPrice = queryClient.getQueryData<{
      pricePerM2: number;
      salePricePerM2?: number | null;
      isSaleActive?: boolean;
      effectivePricePerM2?: number;
    }>(["admin-price"]);
    if (currentPrice) {
      pushPriceUpdates(currentPrice, updatedConfig);
    } else {
      notifyPriceSettingsUpdated({ panneauConfig: updatedConfig });
    }
    success(successMessage);
  };

  const updatePanneauHeightMutation = useMutation({
    mutationFn: async (fixedHeightCm: number) => {
      const response = await fetch("/api/admin/panneau-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fixedHeightCm }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as PanneauConfig;
    },
    onSuccess: (updatedConfig) => {
      applyPanneauConfigUpdate(updatedConfig, "Hauteur fixe mise à jour.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const upsertPanneauWidthMutation = useMutation({
    mutationFn: async (payload: {
      widthCm: number;
      price: number;
      previousWidthCm?: number;
    }) => {
      const response = await fetch("/api/admin/panneau-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ width: payload }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as PanneauConfig;
    },
    onSuccess: (updatedConfig, variables) => {
      applyPanneauConfigUpdate(
        updatedConfig,
        typeof variables.previousWidthCm === "number"
          ? "Largeur panneau mise à jour."
          : "Largeur panneau ajoutée."
      );
      setEditingPanneauWidthCm(null);
      setEditPanneauWidthCm("");
      setEditPanneauWidthPrice("");
      setNewPanneauWidthCm("");
      setNewPanneauWidthPrice("");
      setIsAddingPanneauWidth(false);
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const deletePanneauWidthMutation = useMutation({
    mutationFn: async (widthCm: number) => {
      const response = await fetch("/api/admin/panneau-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteWidthCm: widthCm }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as PanneauConfig;
    },
    onSuccess: (updatedConfig) => {
      applyPanneauConfigUpdate(updatedConfig, "Largeur panneau supprimée.");
      setEditingPanneauWidthCm(null);
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const updatePanneauPromoMutation = useMutation({
    mutationFn: async ({
      promoWidths,
      isSaleActive: nextSaleActive,
    }: {
      promoWidths: Array<{ widthCm: number; salePrice: number | null }>;
      isSaleActive: boolean;
    }) => {
      const response = await fetch("/api/admin/panneau-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promoWidths, isSaleActive: nextSaleActive }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as PanneauConfig;
    },
    onMutate: async ({ promoWidths, isSaleActive: nextSaleActive }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-panneau-config"] });
      const previousConfig = queryClient.getQueryData<PanneauConfig>(["admin-panneau-config"]);

      if (previousConfig && Array.isArray(previousConfig.widths)) {
        const saleByWidth = new Map(
          promoWidths.map((entry) => [entry.widthCm, entry.salePrice] as const)
        );
        const optimisticConfig: PanneauConfig = {
          ...previousConfig,
          isSaleActive: nextSaleActive,
          lastUpdated: new Date().toISOString(),
          widths: previousConfig.widths.map((width) => ({
            ...width,
            salePrice: saleByWidth.has(width.widthCm)
              ? (saleByWidth.get(width.widthCm) ?? null)
              : (width.salePrice ?? null),
          })),
        };

        queryClient.setQueryData(["admin-panneau-config"], optimisticConfig);
        setIsPanneauSaleActive(nextSaleActive);

        const currentPrice = queryClient.getQueryData<{
          pricePerM2: number;
          salePricePerM2?: number | null;
          isSaleActive?: boolean;
          effectivePricePerM2?: number;
        }>(["admin-price"]);
        if (currentPrice) {
          pushPriceUpdates(currentPrice, optimisticConfig);
        } else {
          notifyPriceSettingsUpdated({ panneauConfig: optimisticConfig });
        }
      }

      return { previousConfig };
    },
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(["admin-panneau-config"], updatedConfig);
      setIsPanneauSaleActive(Boolean(updatedConfig.isSaleActive));
      const widths = Array.isArray(updatedConfig.widths) ? updatedConfig.widths : [];
      setPanneauPromoDrafts(mapWidthsToPromoDrafts(widths));
      const currentPrice = queryClient.getQueryData<{
        pricePerM2: number;
        salePricePerM2?: number | null;
        isSaleActive?: boolean;
        effectivePricePerM2?: number;
      }>(["admin-price"]);
      if (currentPrice) {
        pushPriceUpdates(currentPrice, updatedConfig);
      } else {
        notifyPriceSettingsUpdated({ panneauConfig: updatedConfig });
      }
      success(
        updatedConfig.isSaleActive
          ? "Promotion panneau mise à jour avec succès."
          : "Promotion panneau désactivée."
      );
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(["admin-panneau-config"], context.previousConfig);
        setIsPanneauSaleActive(Boolean(context.previousConfig.isSaleActive));
      }
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const updatePanneauSaleToggleMutation = useMutation({
    mutationFn: async (nextSaleActive: boolean) => {
      const response = await fetch("/api/admin/panneau-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isSaleActive: nextSaleActive }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as PanneauConfig;
    },
    onMutate: async (nextSaleActive) => {
      await queryClient.cancelQueries({ queryKey: ["admin-panneau-config"] });
      const previousConfig = queryClient.getQueryData<PanneauConfig>(["admin-panneau-config"]);

      if (previousConfig) {
        const optimisticConfig: PanneauConfig = {
          ...previousConfig,
          isSaleActive: nextSaleActive,
          lastUpdated: new Date().toISOString(),
        };
        queryClient.setQueryData(["admin-panneau-config"], optimisticConfig);
        setIsPanneauSaleActive(nextSaleActive);
        if (!nextSaleActive) {
          setPanneauPromoDrafts(emptyPanneauPromoDrafts(previousConfig.widths ?? []));
        }

        const currentPrice = queryClient.getQueryData<{
          pricePerM2: number;
          salePricePerM2?: number | null;
          isSaleActive?: boolean;
          effectivePricePerM2?: number;
        }>(["admin-price"]);
        if (currentPrice) {
          pushPriceUpdates(currentPrice, optimisticConfig);
        } else {
          notifyPriceSettingsUpdated({ panneauConfig: optimisticConfig });
        }
      }

      return { previousConfig };
    },
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(["admin-panneau-config"], updatedConfig);
      setIsPanneauSaleActive(Boolean(updatedConfig.isSaleActive));
      setPanneauPromoDrafts(emptyPanneauPromoDrafts(updatedConfig.widths ?? []));
      const currentPrice = queryClient.getQueryData<{
        pricePerM2: number;
        salePricePerM2?: number | null;
        isSaleActive?: boolean;
        effectivePricePerM2?: number;
      }>(["admin-price"]);
      if (currentPrice) {
        pushPriceUpdates(currentPrice, updatedConfig);
      } else {
        notifyPriceSettingsUpdated({ panneauConfig: updatedConfig });
      }
      success("Promotion panneau désactivée.");
    },
    onError: (mutationError, _nextSaleActive, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(["admin-panneau-config"], context.previousConfig);
        setIsPanneauSaleActive(Boolean(context.previousConfig.isSaleActive));
        setPanneauPromoDrafts(
          context.previousConfig.isSaleActive === true
            ? mapWidthsToPromoDrafts(context.previousConfig.widths ?? [])
            : emptyPanneauPromoDrafts(context.previousConfig.widths ?? [])
        );
      } else {
        setIsPanneauSaleActive(true);
      }
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const updatePanneauReferenceMutation = useMutation({
    mutationFn: async ({
      productId,
      supportsPanneau,
    }: {
      productId: string;
      supportsPanneau: boolean;
    }) => {
      const response = await fetch(`/api/admin/products?id=${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ supportsPanneau }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data as AdminProduct;
    },
    onMutate: async ({ productId, supportsPanneau }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["admin-products-panneau"] }),
        queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY }),
      ]);

      const previousAdminProducts = queryClient.getQueryData<AdminProduct[]>([
        "admin-products-panneau",
      ]);
      const previousProducts = queryClient.getQueryData(PRODUCTS_QUERY_KEY);

      const patchSupportsPanneau = <T extends { _id?: string; id?: string; supportsPanneau?: boolean }>(
        products: T[] | undefined
      ): T[] | undefined => {
        if (!Array.isArray(products)) {
          return products;
        }
        return products.map((product) =>
          product._id === productId || product.id === productId
            ? { ...product, supportsPanneau }
            : product
        );
      };

      queryClient.setQueryData(["admin-products-panneau"], (current: AdminProduct[] | undefined) =>
        patchSupportsPanneau(current)
      );
      queryClient.setQueryData(PRODUCTS_QUERY_KEY, (current: unknown) =>
        patchSupportsPanneau(current as AdminProduct[] | undefined)
      );

      return { previousAdminProducts, previousProducts };
    },
    onSuccess: (updatedProduct, variables) => {
      if (updatedProduct) {
        queryClient.setQueryData(
          ["admin-products-panneau"],
          (current: AdminProduct[] | undefined) =>
            Array.isArray(current)
              ? current.map((product) =>
                  product._id === updatedProduct._id || product._id === variables.productId
                    ? {
                        ...product,
                        ...updatedProduct,
                        _id: updatedProduct._id || variables.productId,
                        supportsPanneau: updatedProduct.supportsPanneau === true,
                      }
                    : product
                )
              : current
        );
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, (current: AdminProduct[] | undefined) =>
          Array.isArray(current)
            ? current.map((product) =>
                product._id === updatedProduct._id || product._id === variables.productId
                  ? {
                      ...product,
                      ...updatedProduct,
                      _id: updatedProduct._id || variables.productId,
                      supportsPanneau: updatedProduct.supportsPanneau === true,
                    }
                  : product
              )
            : current
        );
      }
      notifyProductsUpdated();
      success(
        variables.supportsPanneau
          ? "Référence ajoutée à l'option panneau."
          : "Référence retirée de l'option panneau."
      );
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousAdminProducts) {
        queryClient.setQueryData(["admin-products-panneau"], context.previousAdminProducts);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, context.previousProducts);
      }
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  // Fetch current installation fee
  const { data: installationFeeData, isPending: installationFeeInitialLoading } = useQuery({
    queryKey: ["admin-installation-fee"],
    queryFn: async () => {
      const response = await fetch("/api/admin/installation-fee");
      const data = await response.json();
      return data.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!installationFeeData || installationFeeHydrated.current) {
      return;
    }

    installationFeeHydrated.current = true;
    setNewInstallationFee(
      typeof installationFeeData.fee === "number" ? installationFeeData.fee.toString() : ""
    );
  }, [installationFeeData]);

  // Update installation fee mutation
  const updateInstallationFeeMutation = useMutation({
    mutationFn: async (fee: number) => {
      const response = await fetch("/api/admin/installation-fee", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fee }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: (updatedFee) => {
      queryClient.setQueryData(["admin-installation-fee"], updatedFee);
      success("Frais de pose mis à jour avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      warning("Veuillez entrer un prix valide.");
      return;
    }
    updatePriceMutation.mutate(price);
  };

  const handleSaleToggle = (nextActive: boolean) => {
    if (!nextActive && priceData?.isSaleActive) {
      setIsSaleActive(false);
      updateSaleMutation.mutate(
        { salePricePerM2: null, isSaleActive: false },
        {
          onError: () => setIsSaleActive(true),
        }
      );
      return;
    }

    setIsSaleActive(nextActive);
  };

  const handleSaleUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSaleActive) {
      updateSaleMutation.mutate({ salePricePerM2: null, isSaleActive: false });
      return;
    }

    const salePrice = parseFloat(newSalePrice.trim().replace(",", "."));
    if (isNaN(salePrice) || salePrice <= 0) {
      warning("Veuillez entrer un prix promotionnel valide.");
      return;
    }

    const cataloguePrice = priceData?.pricePerM2 ?? parseFloat(newPrice);
    if (!isNaN(cataloguePrice) && salePrice >= cataloguePrice) {
      warning("Le prix promotionnel doit être inférieur au prix catalogue.");
      return;
    }

    updateSaleMutation.mutate({ salePricePerM2: salePrice, isSaleActive: true });
  };

  const handlePanneauHeightUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const fixedHeight = parseFloat(fixedPanneauHeight);

    if (isNaN(fixedHeight) || fixedHeight <= 0) {
      warning("Veuillez entrer une hauteur fixe valide.");
      return;
    }

    updatePanneauHeightMutation.mutate(Math.round(fixedHeight));
  };

  const handlePanneauSaleToggle = (nextActive: boolean) => {
    if (!nextActive && panneauConfigData?.isSaleActive === true) {
      setIsPanneauSaleActive(false);
      setPanneauPromoDrafts(emptyPanneauPromoDrafts(panneauConfigData.widths ?? []));
      updatePanneauSaleToggleMutation.mutate(false, {
        onError: () => setIsPanneauSaleActive(true),
      });
      return;
    }

    setIsPanneauSaleActive(nextActive);
    // Keep fields empty until the user types (same idea as m² when inactive / freshly activated).
    setPanneauPromoDrafts(emptyPanneauPromoDrafts(panneauConfigData?.widths ?? []));
  };

  const handlePanneauSaleUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPanneauSaleActive) {
      return;
    }

    const savedWidths = Array.isArray(panneauConfigData?.widths) ? panneauConfigData.widths : [];
    if (savedWidths.length === 0) {
      warning("Ajoutez d'abord une largeur panneau.");
      return;
    }

    const promoWidths: Array<{ widthCm: number; salePrice: number | null }> = [];
    let hasAtLeastOnePromoPrice = false;

    for (const savedWidth of savedWidths) {
      const salePriceRaw = (panneauPromoDrafts[String(savedWidth.widthCm)] ?? "").trim();

      if (salePriceRaw === "") {
        promoWidths.push({ widthCm: savedWidth.widthCm, salePrice: null });
        continue;
      }

      const salePrice = parseFloat(salePriceRaw.replace(",", "."));
      if (isNaN(salePrice) || salePrice <= 0) {
        warning(`Prix promotionnel invalide pour ${savedWidth.widthCm} cm.`);
        return;
      }

      if (salePrice >= savedWidth.price) {
        warning(
          `Le prix promo pour ${savedWidth.widthCm} cm doit être inférieur au prix catalogue.`
        );
        return;
      }

      hasAtLeastOnePromoPrice = true;
      promoWidths.push({ widthCm: savedWidth.widthCm, salePrice });
    }

    if (!hasAtLeastOnePromoPrice) {
      warning("Saisissez au moins un prix promotionnel avant d'enregistrer.");
      return;
    }

    updatePanneauPromoMutation.mutate({
      promoWidths,
      isSaleActive: true,
    });
  };

  const savedPanneauWidths: PanneauWidthConfig[] = Array.isArray(panneauConfigData?.widths)
    ? panneauConfigData.widths
    : [];

  const handleAddPanneauWidth = () => {
    if (upsertPanneauWidthMutation.isPending) {
      return;
    }

    const widthCm = parseFloat(newPanneauWidthCm);
    const price = parseFloat(newPanneauWidthPrice.replace(",", "."));

    if (isNaN(widthCm) || widthCm <= 0 || isNaN(price) || price <= 0) {
      warning("Veuillez entrer une largeur et un prix valides.");
      return;
    }

    const roundedWidth = Math.round(widthCm);
    if (savedPanneauWidths.some((width) => width.widthCm === roundedWidth)) {
      warning("Cette largeur existe déjà.");
      return;
    }

    upsertPanneauWidthMutation.mutate({
      widthCm: roundedWidth,
      price,
    });
  };

  const handleCancelAddPanneauWidth = () => {
    setNewPanneauWidthCm("");
    setNewPanneauWidthPrice("");
    setIsAddingPanneauWidth(false);
  };

  const handleOpenAddPanneauWidth = () => {
    setEditingPanneauWidthCm(null);
    setNewPanneauWidthCm("");
    setNewPanneauWidthPrice("");
    setIsAddingPanneauWidth(true);
  };

  const handleAddPanneauWidthKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddPanneauWidth();
    }
  };

  const handleStartEditPanneauWidth = (width: { widthCm: number; price: number }) => {
    setIsAddingPanneauWidth(false);
    setEditingPanneauWidthCm(width.widthCm);
    setEditPanneauWidthCm(width.widthCm.toString());
    setEditPanneauWidthPrice(width.price.toString());
  };

  const handleCancelEditPanneauWidth = () => {
    setEditingPanneauWidthCm(null);
    setEditPanneauWidthCm("");
    setEditPanneauWidthPrice("");
  };

  const handleSaveEditPanneauWidth = () => {
    if (editingPanneauWidthCm === null || upsertPanneauWidthMutation.isPending) {
      return;
    }

    const widthCm = parseFloat(editPanneauWidthCm);
    const price = parseFloat(editPanneauWidthPrice.replace(",", "."));

    if (isNaN(widthCm) || widthCm <= 0 || isNaN(price) || price <= 0) {
      warning("Veuillez entrer une largeur et un prix valides.");
      return;
    }

    const roundedWidth = Math.round(widthCm);
    if (
      roundedWidth !== editingPanneauWidthCm &&
      savedPanneauWidths.some((width) => width.widthCm === roundedWidth)
    ) {
      warning("Cette largeur existe déjà.");
      return;
    }

    upsertPanneauWidthMutation.mutate({
      widthCm: roundedWidth,
      price,
      previousWidthCm: editingPanneauWidthCm,
    });
  };

  const handleEditPanneauWidthKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSaveEditPanneauWidth();
    }
  };

  const handleRemovePanneauWidth = (widthCm: number) => {
    if (deletePanneauWidthMutation.isPending) {
      return;
    }
    deletePanneauWidthMutation.mutate(widthCm);
  };

  const handleTogglePanneauReference = (productId: string, supportsPanneau: boolean) => {
    updatePanneauReferenceMutation.mutate({ productId, supportsPanneau });
  };

  const handleInstallationFeeUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(newInstallationFee);
    if (isNaN(fee) || fee < 0) {
      warning("Veuillez entrer des frais valides.");
      return;
    }
    updateInstallationFeeMutation.mutate(fee);
  };

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  const storeListPrice = priceData?.pricePerM2 ?? 0;
  const parsedSalePrice = parseFloat(newSalePrice.trim().replace(",", "."));
  const salePriceError =
    isSaleActive &&
    newSalePrice.trim() !== "" &&
    !Number.isNaN(parsedSalePrice) &&
    parsedSalePrice >= storeListPrice
      ? "Doit être inférieur au prix catalogue"
      : undefined;
  const hasDraftSalePrice =
    isSaleActive &&
    newSalePrice.trim() !== "" &&
    !Number.isNaN(parsedSalePrice) &&
    parsedSalePrice > 0 &&
    parsedSalePrice < storeListPrice;
  const savedSalePrice =
    typeof priceData?.salePricePerM2 === "number"
      ? Number(priceData.salePricePerM2.toFixed(2))
      : null;
  const draftSalePrice = hasDraftSalePrice ? Number(parsedSalePrice.toFixed(2)) : null;
  const hasUnsavedStoreSale =
    isSaleActive &&
    draftSalePrice !== null &&
    !Boolean(salePriceError) &&
    (priceData?.isSaleActive !== true || draftSalePrice !== savedSalePrice);
  const activeSalePrice = hasDraftSalePrice
    ? parsedSalePrice
    : priceData?.isSaleActive === true
      ? savedSalePrice
      : null;
  const isStoreOnSale = activeSalePrice !== null;
  const hasPanneauPromoError = (panneauConfigData?.widths ?? []).some(
    (width: { widthCm: number; price: number }) => {
      if (!isPanneauSaleActive) {
        return false;
      }

      const saleValue = (panneauPromoDrafts[String(width.widthCm)] ?? "").trim();
      if (saleValue === "") {
        return false;
      }

      const salePrice = parseFloat(saleValue.replace(",", "."));
      return !Number.isNaN(salePrice) && salePrice >= width.price;
    }
  );
  const hasValidPanneauPromoDraft = (panneauConfigData?.widths ?? []).some(
    (width: { widthCm: number; price: number }) => {
      const saleValue = (panneauPromoDrafts[String(width.widthCm)] ?? "").trim();
      if (saleValue === "") {
        return false;
      }

      const salePrice = parseFloat(saleValue.replace(",", "."));
      return (
        !Number.isNaN(salePrice) &&
        salePrice > 0 &&
        salePrice < width.price
      );
    }
  );
  const hasUnsavedPanneauPromo =
    isPanneauSaleActive &&
    hasValidPanneauPromoDraft &&
    !hasPanneauPromoError &&
    ((panneauConfigData?.isSaleActive !== true) ||
      (panneauConfigData?.widths ?? []).some(
        (width: { widthCm: number; salePrice?: number | null }) => {
          const draftRaw = (panneauPromoDrafts[String(width.widthCm)] ?? "").trim();
          const draftPrice =
            draftRaw === ""
              ? null
              : Number(parseFloat(draftRaw.replace(",", ".")).toFixed(2));
          const savedPrice =
            typeof width.salePrice === "number"
              ? Number(width.salePrice.toFixed(2))
              : null;

          if (draftPrice === null && savedPrice === null) {
            return false;
          }

          return draftPrice !== savedPrice;
        }
      ));
  const formatLastUpdated = (value?: string) =>
    value
      ? new Date(value).toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const panneauTableShellClassName =
    "w-full max-w-full overflow-hidden rounded-lg bg-white dark:bg-gray-800";
  const panneauWidthGridClass =
    "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem]";
  const panneauWidthCellClass = "flex min-w-0 items-center justify-center";
  const panneauWidthActionsClass = "flex items-center justify-center gap-1";
  const panneauCellInputClass = `${formFieldClass} text-center`;
  const isPanneauPromoSaved = panneauConfigData?.isSaleActive === true;
  const canSavePanneauPromo =
    hasUnsavedPanneauPromo &&
    !updatePanneauPromoMutation.isPending &&
    !updatePanneauSaleToggleMutation.isPending;
  const canSaveStoreSale =
    hasUnsavedStoreSale && !updateSaleMutation.isPending;
  const panneauReferenceCheckboxBoxClass =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-gray-300 bg-white shadow-sm transition-all duration-200 peer-checked:border-amber-500 peer-checked:bg-gradient-to-br peer-checked:from-amber-400 peer-checked:to-amber-500 peer-checked:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:peer-checked:border-amber-400 dark:peer-checked:from-amber-500 dark:peer-checked:to-amber-600";
  const panneauPlusButtonClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white text-lg font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50";
  const panneauConfirmButtonClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-300 bg-white text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-700 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/50";
  const panneauEditButtonClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
  const canConfirmNewPanneauWidth =
    isAddingPanneauWidth &&
    newPanneauWidthCm.trim() !== "" &&
    newPanneauWidthPrice.trim() !== "" &&
    !Number.isNaN(parseFloat(newPanneauWidthCm)) &&
    parseFloat(newPanneauWidthCm) > 0 &&
    !Number.isNaN(parseFloat(newPanneauWidthPrice.replace(",", "."))) &&
    parseFloat(newPanneauWidthPrice.replace(",", ".")) > 0 &&
    !upsertPanneauWidthMutation.isPending;
  const canConfirmEditPanneauWidth =
    editingPanneauWidthCm !== null &&
    editPanneauWidthCm.trim() !== "" &&
    editPanneauWidthPrice.trim() !== "" &&
    !Number.isNaN(parseFloat(editPanneauWidthCm)) &&
    parseFloat(editPanneauWidthCm) > 0 &&
    !Number.isNaN(parseFloat(editPanneauWidthPrice.replace(",", "."))) &&
    parseFloat(editPanneauWidthPrice.replace(",", ".")) > 0 &&
    !upsertPanneauWidthMutation.isPending;
  const CheckIcon = (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
  const EditIcon = (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 3.487a2.1 2.1 0 113 3L8.25 18.1 4 19.25l1.15-4.25 11.712-11.513z"
      />
    </svg>
  );

  return (
    <>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content="Tableau de bord administrateur - Rideaux Bambou" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Unified management section */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-0 shadow-xl dark:from-gray-800 dark:via-gray-800 dark:to-gray-900">
              <div className="border-b border-gray-200 bg-white/70 px-6 py-6 dark:border-gray-700 dark:bg-gray-900/40">
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Bienvenue, {session.user?.firstName} {session.user?.lastName}!
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Gérez votre boutique depuis ce tableau de bord.
                </p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Gestion des Prix et Frais
                  </h3>
                  <p className="mt-1.5 text-base text-gray-600 dark:text-gray-400">
                    Tarifs store, panneau, promotions et frais de pose affichés sur la boutique.
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:items-stretch">
                  <div className="flex min-h-[5.5rem] flex-col rounded-xl border border-green-200/80 border-l-4 border-l-green-600 bg-white px-4 py-3 dark:border-green-900/50 dark:border-l-green-500 dark:bg-gray-900/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Prix / m²
                    </p>
                    {priceInitialLoading ? (
                      <p className="mt-1 text-sm text-gray-500">…</p>
                    ) : (
                      <div className="mt-1">
                        <PriceDisplay
                          pricePerM2={storeListPrice}
                          salePricePerM2={activeSalePrice}
                          isSaleActive={isStoreOnSale}
                          suffix=" TND/m²"
                          listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                          saleClassName="text-lg font-semibold text-green-600 dark:text-green-400"
                        />
                      </div>
                    )}
                  </div>
                  {(panneauConfigData?.widths ?? []).map(
                    (width: {
                      id: string;
                      widthCm: number;
                      label?: string | null;
                      price: number;
                      salePrice?: number | null;
                    }) => {
                      const effectivePrice = getEffectivePanneauWidthPrice(
                        {
                          price: width.price,
                          salePrice: width.salePrice ?? null,
                        },
                        panneauConfigData?.isSaleActive === true
                      );
                      const onPromo =
                        panneauConfigData?.isSaleActive === true &&
                        effectivePrice < width.price;

                      return (
                    <div
                      key={width.id}
                      className="flex min-h-[5.5rem] flex-col rounded-xl border border-amber-200/80 border-l-4 border-l-amber-500 bg-white px-4 py-3 dark:border-amber-900/50 dark:border-l-amber-500 dark:bg-gray-900/50"
                    >
                      <p className="text-xs font-medium tracking-wide text-gray-500 dark:text-gray-400">
                        {formatPanneauCardLabel(width.widthCm)}
                      </p>
                      {panneauConfigInitialLoading ? (
                        <p className="mt-1 text-sm text-gray-500">…</p>
                      ) : (
                        <div className="mt-1">
                          <PriceDisplay
                            pricePerM2={width.price}
                            salePricePerM2={width.salePrice ?? null}
                            isSaleActive={onPromo}
                            suffix=" TND"
                            listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                            saleClassName="text-lg font-semibold text-amber-700 dark:text-amber-300"
                          />
                        </div>
                      )}
                    </div>
                      );
                    }
                  )}
                  <div className="flex min-h-[5.5rem] flex-col rounded-xl border border-blue-200/80 border-l-4 border-l-blue-600 bg-white px-4 py-3 dark:border-blue-900/50 dark:border-l-blue-500 dark:bg-gray-900/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Pose
                    </p>
                    {installationFeeInitialLoading ? (
                      <p className="mt-1 text-sm text-gray-500">…</p>
                    ) : (
                      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                        {installationFeeData?.fee} TND
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-green-200/70 bg-white shadow-sm dark:border-green-900/40 dark:bg-gray-900/40">
                    <div className="border-b border-green-100 bg-gradient-to-r from-green-50 via-white to-emerald-50 px-6 py-5 dark:border-green-900/30 dark:from-green-950/30 dark:via-gray-900/40 dark:to-emerald-950/20">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-lg font-semibold text-green-800 dark:text-green-300">
                          Prix du m²
                        </h4>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200 ${
                              isSaleActive || priceData?.isSaleActive === true
                                ? ""
                                : "invisible"
                            }`}
                          >
                            Promotion active
                          </span>
                          {priceData?.lastUpdated && (
                            <p className="text-xs text-gray-500">
                              Mis à jour {formatLastUpdated(priceData.lastUpdated)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6 p-6">
                      <div className="rounded-xl border border-green-100 bg-green-50/50 px-4 py-3 dark:border-green-900/30 dark:bg-green-950/20">
                        <p className="text-xs font-medium uppercase tracking-wide text-green-700/80 dark:text-green-300/80">
                          Prix catalogue
                        </p>
                          {priceInitialLoading ? (
                            <p className="mt-2 text-sm text-gray-500">Chargement...</p>
                          ) : (
                            <div className="mt-2">
                              <PriceDisplay
                                pricePerM2={storeListPrice}
                                salePricePerM2={activeSalePrice}
                                isSaleActive={isStoreOnSale}
                                suffix=" TND/m²"
                                className="text-2xl font-semibold"
                                listClassName="text-lg text-gray-500 line-through dark:text-gray-400"
                                saleClassName="text-2xl font-semibold text-green-600 dark:text-green-400"
                              />
                            </div>
                          )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
                        <h5 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
                          Modifier le tarif catalogue
                        </h5>
                        <form onSubmit={handlePriceUpdate}>
                          <Input
                            label="Nouveau prix catalogue"
                            type="text"
                            inputMode="decimal"
                            pattern="^[0-9]+([.,][0-9]{1,2})?$"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value.replace(",", "."))}
                            placeholder="Ex: 77"
                            className="text-sm"
                            endAction={
                              <Button
                                type="submit"
                                size="sm"
                                disabled={updatePriceMutation.isPending}
                              >
                                Mettre à jour
                              </Button>
                            }
                          />
                        </form>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-base font-semibold text-gray-900 dark:text-white">
                              Promotion
                            </h5>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            <span
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                isSaleActive ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSaleActive}
                                onChange={(e) => handleSaleToggle(e.target.checked)}
                                className="sr-only"
                              />
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  isSaleActive ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                            {isSaleActive ? "Active" : "Inactive"}
                          </label>
                        </div>
                        <form onSubmit={handleSaleUpdate} noValidate className="space-y-4">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={newSalePrice}
                            onChange={(e) => setNewSalePrice(e.target.value.replace(",", "."))}
                            placeholder="Ex: 60"
                            error={salePriceError}
                            className="text-sm"
                            disabled={!isSaleActive}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={!canSaveStoreSale || Boolean(salePriceError)}
                          >
                            Enregistrer la promotion
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-blue-200/70 bg-white shadow-sm dark:border-blue-900/40 dark:bg-gray-900/40">
                    <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-6 py-5 dark:border-blue-900/30 dark:from-blue-950/30 dark:via-gray-900/40 dark:to-sky-950/20">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                            Frais de pose
                          </h4>
                        </div>
                        {installationFeeData?.lastUpdated && (
                          <p className="text-xs text-gray-500">
                            Mis à jour {formatLastUpdated(installationFeeData.lastUpdated)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 p-6">
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 dark:border-blue-900/30 dark:bg-blue-950/20">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700/80 dark:text-blue-300/80">
                          Frais de pose
                        </p>
                          {installationFeeInitialLoading ? (
                            <p className="mt-2 text-sm text-gray-500">Chargement...</p>
                          ) : (
                            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                              {installationFeeData?.fee} TND
                            </p>
                          )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
                        <h5 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
                          Modifier le tarif
                        </h5>
                        <form onSubmit={handleInstallationFeeUpdate}>
                          <Input
                            label="Nouveau tarif"
                            type="text"
                            inputMode="decimal"
                            pattern="^[0-9]+([.,][0-9]{1,2})?$"
                            value={newInstallationFee}
                            onChange={(e) => setNewInstallationFee(e.target.value.replace(",", "."))}
                            placeholder="Ex: 11"
                            className="text-sm"
                            endAction={
                              <Button
                                type="submit"
                                size="sm"
                                disabled={updateInstallationFeeMutation.isPending}
                              >
                                Mettre à jour
                              </Button>
                            }
                          />
                        </form>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm dark:border-amber-900/40 dark:bg-gray-900/40">
                  <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-6 py-5 dark:border-amber-900/30 dark:from-amber-950/30 dark:via-gray-900/40 dark:to-orange-950/20">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                        Configuration panneau
                      </h4>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${
                            isPanneauPromoSaved ? "" : "invisible"
                          }`}
                        >
                          Promotion active
                        </span>
                        {panneauConfigData?.lastUpdated && (
                          <p className="text-xs text-gray-500">
                            Mis à jour {formatLastUpdated(panneauConfigData.lastUpdated)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 p-6">
                    {panneauConfigInitialLoading ? (
                      <p className="text-sm text-gray-500">Chargement...</p>
                    ) : (panneauConfigData?.widths ?? []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
                        Aucune largeur configurée pour le moment.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {(panneauConfigData?.widths ?? []).map(
                            (width: {
                              id: string;
                              widthCm: number;
                              label?: string | null;
                              price: number;
                              salePrice?: number | null;
                            }) => {
                              const effectivePrice = getEffectivePanneauWidthPrice(
                                {
                                  price: width.price,
                                  salePrice: width.salePrice ?? null,
                                },
                                panneauConfigData?.isSaleActive === true
                              );
                              const onPromo =
                                panneauConfigData?.isSaleActive === true &&
                                effectivePrice < width.price;

                              return (
                              <div
                                key={width.id}
                                className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20"
                              >
                                <p className="text-xs font-medium tracking-wide text-amber-700/80 dark:text-amber-300/80">
                                  {formatPanneauCardLabel(width.widthCm)}
                                </p>
                                <div className="mt-2">
                                  <PriceDisplay
                                    pricePerM2={width.price}
                                    salePricePerM2={width.salePrice ?? null}
                                    isSaleActive={onPromo}
                                    suffix=" TND"
                                    listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                                    saleClassName="text-lg font-semibold text-amber-700 dark:text-amber-300"
                                  />
                                </div>
                              </div>
                              );
                            }
                          )}
                        </div>
                      )}

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                      <div className="space-y-4 xl:col-span-2">
                        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="text-base font-semibold text-gray-900 dark:text-white">
                                Dimensions & tarifs
                              </h5>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Hauteur fixe et largeurs proposées dans le configurateur.
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                              {savedPanneauWidths.length} modèle
                              {savedPanneauWidths.length > 1 ? "s" : ""}
                            </span>
                          </div>

                          <div className="space-y-5">
                            <form onSubmit={handlePanneauHeightUpdate} className="max-w-md">
                              <Input
                                label="Hauteur fixe (cm)"
                                type="text"
                                inputMode="numeric"
                                pattern="^[0-9]+$"
                                value={fixedPanneauHeight}
                                onChange={(e) =>
                                  setFixedPanneauHeight(e.target.value.replace(",", "."))
                                }
                                placeholder="220"
                                className="text-sm"
                                endAction={
                                  <Button
                                    type="submit"
                                    size="sm"
                                    disabled={updatePanneauHeightMutation.isPending}
                                  >
                                    Mettre à jour
                                  </Button>
                                }
                              />
                            </form>

                            <div className={panneauTableShellClassName}>
                              <div
                                className={`hidden w-full gap-3 ${adminTableHeaderClassName} px-3 py-3 sm:px-4 md:grid ${panneauWidthGridClass}`}
                              >
                                <span className={`${panneauWidthCellClass} ${adminTableHeadTextClassName}`}>
                                  Largeur (cm)
                                </span>
                                <span className={`${panneauWidthCellClass} ${adminTableHeadTextClassName}`}>
                                  Prix catalogue
                                </span>
                                <span className={`${panneauWidthCellClass} ${adminTableHeadTextClassName}`}>
                                  Action
                                </span>
                              </div>

                              {savedPanneauWidths.length === 0 && !isAddingPanneauWidth ? (
                                <p className="px-3 py-4 text-center text-sm text-gray-500 sm:px-4 dark:text-gray-400">
                                  Aucune largeur configurée.
                                </p>
                              ) : savedPanneauWidths.length > 0 ? (
                                <div className={`w-full ${adminTableBodyClassName}`}>
                                  {savedPanneauWidths.map((width) => {
                                    const isEditing = editingPanneauWidthCm === width.widthCm;

                                    return (
                                      <div
                                        key={width.id}
                                        className={`grid w-full grid-cols-1 items-center gap-3 px-3 py-4 sm:px-4 md:grid ${panneauWidthGridClass}`}
                                      >
                                        {isEditing ? (
                                          <>
                                            <div className={panneauWidthCellClass}>
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                value={editPanneauWidthCm}
                                                onChange={(e) =>
                                                  setEditPanneauWidthCm(e.target.value)
                                                }
                                                onKeyDown={handleEditPanneauWidthKeyDown}
                                                autoFocus
                                                className={panneauCellInputClass}
                                              />
                                            </div>
                                            <div className={panneauWidthCellClass}>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={editPanneauWidthPrice}
                                                onChange={(e) =>
                                                  setEditPanneauWidthPrice(
                                                    e.target.value.replace(",", ".")
                                                  )
                                                }
                                                onKeyDown={handleEditPanneauWidthKeyDown}
                                                className={panneauCellInputClass}
                                              />
                                            </div>
                                            <div className={panneauWidthActionsClass}>
                                              <button
                                                type="button"
                                                onClick={handleSaveEditPanneauWidth}
                                                disabled={!canConfirmEditPanneauWidth}
                                                className={panneauConfirmButtonClass}
                                                aria-label="Enregistrer la largeur"
                                              >
                                                {CheckIcon}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditPanneauWidth}
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                                aria-label="Annuler"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <p
                                              className={`${panneauWidthCellClass} text-sm font-medium text-gray-900 dark:text-white`}
                                            >
                                              {width.widthCm}
                                            </p>
                                            <p
                                              className={`${panneauWidthCellClass} text-sm font-medium text-gray-900 dark:text-white`}
                                            >
                                              {width.price.toFixed(2)} TND
                                            </p>
                                            <div className={panneauWidthActionsClass}>
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditPanneauWidth(width)}
                                                className={panneauEditButtonClass}
                                                aria-label="Modifier cette largeur"
                                              >
                                                {EditIcon}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleRemovePanneauWidth(width.widthCm)
                                                }
                                                disabled={deletePanneauWidthMutation.isPending}
                                                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                                aria-label="Retirer cette largeur"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {isAddingPanneauWidth ? (
                                <div
                                  className={`grid w-full grid-cols-1 items-center gap-3 border-t border-gray-200 bg-white px-3 py-4 sm:px-4 dark:border-gray-700 dark:bg-gray-800 md:grid ${panneauWidthGridClass}`}
                                >
                                  <div className={panneauWidthCellClass}>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={newPanneauWidthCm}
                                      onChange={(e) => setNewPanneauWidthCm(e.target.value)}
                                      onKeyDown={handleAddPanneauWidthKeyDown}
                                      autoFocus
                                      className={panneauCellInputClass}
                                    />
                                  </div>
                                  <div className={panneauWidthCellClass}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={newPanneauWidthPrice}
                                      onChange={(e) =>
                                        setNewPanneauWidthPrice(e.target.value.replace(",", "."))
                                      }
                                      onKeyDown={handleAddPanneauWidthKeyDown}
                                      className={panneauCellInputClass}
                                    />
                                  </div>
                                  <div className={panneauWidthActionsClass}>
                                    <button
                                      type="button"
                                      onClick={handleAddPanneauWidth}
                                      disabled={!canConfirmNewPanneauWidth}
                                      className={
                                        canConfirmNewPanneauWidth
                                          ? panneauConfirmButtonClass
                                          : panneauPlusButtonClass
                                      }
                                      aria-label="Enregistrer la nouvelle largeur"
                                    >
                                      {canConfirmNewPanneauWidth ? CheckIcon : "+"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelAddPanneauWidth}
                                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                      aria-label="Annuler"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex w-full justify-end border-t border-gray-200 bg-white px-3 py-4 sm:px-4 dark:border-gray-700 dark:bg-gray-800">
                                  <button
                                    type="button"
                                    onClick={handleOpenAddPanneauWidth}
                                    className={panneauPlusButtonClass}
                                    aria-label="Ajouter un modèle"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="text-base font-semibold text-gray-900 dark:text-white">
                                Promotion
                              </h5>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Les prix promo se sauvegardent uniquement ici.
                              </p>
                            </div>
                            <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                              <span
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                  isPanneauSaleActive
                                    ? "bg-green-600"
                                    : "bg-gray-300 dark:bg-gray-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isPanneauSaleActive}
                                  onChange={(e) => handlePanneauSaleToggle(e.target.checked)}
                                  className="sr-only"
                                />
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    isPanneauSaleActive ? "translate-x-4" : "translate-x-0.5"
                                  }`}
                                />
                              </span>
                              {isPanneauSaleActive ? "Active" : "Inactive"}
                            </label>
                          </div>

                          <form onSubmit={handlePanneauSaleUpdate} className="space-y-4">
                            {(panneauConfigData?.widths ?? []).length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Ajoutez d&apos;abord une largeur panneau.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {(panneauConfigData?.widths ?? []).map(
                                  (width: {
                                    widthCm: number;
                                    price: number;
                                    salePrice?: number | null;
                                  }) => {
                                    const promoKey = String(width.widthCm);
                                    const saleValue = panneauPromoDrafts[promoKey] ?? "";
                                    const saleNumber = parseFloat(saleValue.replace(",", "."));
                                    const hasSaleError =
                                      isPanneauSaleActive &&
                                      saleValue.trim() !== "" &&
                                      !Number.isNaN(saleNumber) &&
                                      saleNumber >= width.price;

                                    return (
                                      <div
                                        key={width.widthCm}
                                        className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {formatPanneauCardLabel(width.widthCm)}
                                          </p>
                                        </div>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={saleValue}
                                          onChange={(e) => {
                                            const nextSale = e.target.value.replace(",", ".");
                                            setPanneauPromoDrafts((previous) => ({
                                              ...previous,
                                              [promoKey]: nextSale,
                                            }));
                                          }}
                                          placeholder="Ex: 140"
                                          disabled={!isPanneauSaleActive}
                                          className={`${panneauCellInputClass} ${
                                            hasSaleError
                                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                              : ""
                                          }`}
                                        />
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}

                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              disabled={!canSavePanneauPromo}
                            >
                              Enregistrer la promotion
                            </Button>
                          </form>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="text-base font-semibold text-gray-900 dark:text-white">
                                Références produits
                              </h5>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Produits disponibles en option panneau.
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50">
                              {activeProducts.filter((p) => p.supportsPanneau === true).length} /{" "}
                              {activeProducts.length}
                            </span>
                          </div>
                          {adminProductsLoading ? (
                            <p className="text-sm text-gray-500">Chargement...</p>
                          ) : activeProducts.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun produit actif.</p>
                          ) : (
                            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                              {activeProducts.map((product) => (
                                <label
                                  key={product._id}
                                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                                    product.supportsPanneau === true
                                      ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20"
                                      : "border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                                  }`}
                                >
                                  <span className="font-medium text-gray-800 dark:text-gray-200">
                                    {product.name}
                                  </span>
                                  <span className="relative inline-flex shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={product.supportsPanneau === true}
                                      disabled={
                                        updatePanneauReferenceMutation.isPending &&
                                        updatePanneauReferenceMutation.variables?.productId ===
                                          product._id
                                      }
                                      onChange={(e) =>
                                        handleTogglePanneauReference(product._id, e.target.checked)
                                      }
                                      className="peer sr-only"
                                    />
                                    <span aria-hidden="true" className={panneauReferenceCheckboxBoxClass}>
                                      <svg
                                        className={`h-3.5 w-3.5 text-white transition-opacity duration-200 ${
                                          product.supportsPanneau === true ? "opacity-100" : "opacity-0"
                                        }`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Dashboard Charts */}
            <div>
              <DashboardCharts />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

