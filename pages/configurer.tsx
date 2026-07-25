import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import StorePanelBreakdown, {
  StorePanelQuantityHint,
} from "../components/StorePanelBreakdown";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { useToast } from "../contexts/ToastContext";
import { FiTrash2 } from "react-icons/fi";
import { formatPanneauWidthOption } from "../lib/panneau-pricing";
import {
  formFieldClass,
  formFieldDisabledClass,
  formFieldLabelClass,
  formNumberFieldClass,
  formSelectClass,
} from "../lib/form-field-styles";
import { usePublicProductsQuery } from "../lib/products-query";
import { OUT_OF_STOCK_CLIENT_MESSAGE } from "../lib/product-availability-sync";
import {
  MAX_STORE_WIDTH_CM,
  getStorePanelMeasurements,
} from "../lib/store-panel-count";
import { getCurtainLineTotal } from "../lib/order-pricing";
import {
  formatMeasurement,
  parseMeasurement,
  sanitizeMeasurementInput,
} from "../lib/measurement-input";

interface Product {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
  supportsPanneau?: boolean;
}

export default function ConfigurerProduitPage() {
  const router = useRouter();
  const {
    addItem,
    removeItem,
    items,
    calculatePrice,
    panneauConfig,
    pricesLoaded,
    getTotalItems,
    getTotalPrice,
  } = useSimpleCart();
  const { success } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [width, setWidth] = useState<number | "">("");
  const [storeWidthInput, setStoreWidthInput] = useState("");
  const [height, setHeight] = useState<number | "">("");
  const [curtainType, setCurtainType] = useState<"panneau" | "store">("panneau");
  const [quantity, setQuantity] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState("");
  const hasInitializedSelectionRef = useRef(false);
  const lastAppliedQueryProductIdRef = useRef<string | null>(null);
  const pendingUrlSelectionRef = useRef<{ id: string; type: "panneau" | "store" } | null>(null);
  const [priceCalculation, setPriceCalculation] = useState({ area: 0, pricePerM2: 0, total: 0 });
  const [showContinueConfirm, setShowContinueConfirm] = useState(false);

  const { data: productsData, isLoading: isProductsLoading } = usePublicProductsQuery();

  const products = useMemo(() => (Array.isArray(productsData) ? productsData : []), [productsData]);
  const storeProducts = products;
  const panneauProductsAll = useMemo(
    () => products.filter((item) => item.supportsPanneau === true),
    [products]
  );
  const availableStoreProducts = useMemo(
    () => storeProducts.filter((item) => item.isAvailable !== false),
    [storeProducts]
  );
  const availablePanneauProducts = useMemo(
    () => panneauProductsAll.filter((item) => item.isAvailable !== false),
    [panneauProductsAll]
  );
  const panneauWidthValues = useMemo(
    () => new Set(panneauConfig.widths.map((entry) => entry.widthCm)),
    [panneauConfig.widths]
  );
  const productsForCurtainType =
    curtainType === "panneau" ? panneauProductsAll : storeProducts;
  const availableProductsForCurtainType =
    curtainType === "panneau" ? availablePanneauProducts : availableStoreProducts;

  const queryProductId =
    typeof router.query.productId === "string" ? router.query.productId : "";

  useEffect(() => {
    if (!router.isReady || isProductsLoading) {
      return;
    }

    if (!products.length) {
      return;
    }

    const queryProduct = queryProductId
      ? products.find((product) => product._id === queryProductId)
      : undefined;

    // Apply URL productId once per value so home clicks open the right reference.
    if (queryProduct && queryProductId !== lastAppliedQueryProductIdRef.current) {
      const nextType = queryProduct.supportsPanneau === true ? "panneau" : "store";
      pendingUrlSelectionRef.current = { id: queryProduct._id, type: nextType };
      setCurtainType(nextType);
      setSelectedProductId(queryProduct._id);
      lastAppliedQueryProductIdRef.current = queryProductId;
      hasInitializedSelectionRef.current = true;
      return;
    }

    if (hasInitializedSelectionRef.current) {
      return;
    }

    if (availablePanneauProducts.length > 0) {
      setCurtainType("panneau");
    } else {
      setCurtainType("store");
    }
    setSelectedProductId("");

    hasInitializedSelectionRef.current = true;
  }, [
    router.isReady,
    queryProductId,
    isProductsLoading,
    products,
    availablePanneauProducts,
    availableStoreProducts,
  ]);

  useEffect(() => {
    if (!hasInitializedSelectionRef.current) {
      return;
    }

    // Finish applying a URL selection once curtain type has caught up (avoids the
    // race that used to force the first panneau reference on every click).
    if (pendingUrlSelectionRef.current) {
      const pending = pendingUrlSelectionRef.current;
      if (curtainType !== pending.type) {
        return;
      }
      pendingUrlSelectionRef.current = null;
      if (productsForCurtainType.some((product) => product._id === pending.id)) {
        if (selectedProductId !== pending.id) {
          setSelectedProductId(pending.id);
        }
        return;
      }
    }

    if (!productsForCurtainType.length) {
      if (selectedProductId) {
        setSelectedProductId("");
      }
      return;
    }

    if (
      selectedProductId &&
      productsForCurtainType.some((product) => product._id === selectedProductId)
    ) {
      return;
    }

    // Prefer the URL product when it belongs to the current curtain type.
    if (
      queryProductId &&
      productsForCurtainType.some((product) => product._id === queryProductId)
    ) {
      setSelectedProductId(queryProductId);
      return;
    }

    // Curtain type changed: clear so the user picks a reference (admin-style).
    setSelectedProductId("");
  }, [
    productsForCurtainType,
    availableProductsForCurtainType,
    selectedProductId,
    curtainType,
    queryProductId,
  ]);

  const selectedProduct = useMemo(
    () => productsForCurtainType.find((product) => product._id === selectedProductId) ?? null,
    [productsForCurtainType, selectedProductId]
  );

  const product = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    return {
      productId: selectedProduct._id,
      productName: selectedProduct.name,
      productImage: selectedProduct.image || "",
      isAvailable: selectedProduct.isAvailable !== false,
    };
  }, [selectedProduct]);

  useEffect(() => {
    const updateDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateDarkMode();

    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (curtainType === "panneau") {
      setHeight(panneauConfig.fixedHeightCm);
      setWidth((prevWidth) =>
        typeof prevWidth === "number" && panneauWidthValues.has(prevWidth) ? prevWidth : ""
      );
      setStoreWidthInput("");
      setQuantity(1);
      return;
    }

    setHeight((prevHeight) =>
      prevHeight === panneauConfig.fixedHeightCm ? "" : prevHeight
    );
    setWidth((prevWidth) =>
      typeof prevWidth === "number" && panneauWidthValues.has(prevWidth) ? "" : prevWidth
    );
  }, [curtainType, panneauConfig.fixedHeightCm, panneauWidthValues]);

  useEffect(() => {
    if (width === "" || height === "" || width <= 0 || height <= 0) {
      setPriceCalculation({ area: 0, pricePerM2: 0, total: 0 });
      return;
    }

    const calculation = calculatePrice(width, height, curtainType);
    setPriceCalculation(calculation);
  }, [width, height, curtainType, calculatePrice, panneauConfig, pricesLoaded]);

  const resetProductFields = () => {
    setWidth("");
    setStoreWidthInput("");
    if (curtainType === "store") {
      setHeight("");
      setQuantity(1);
    } else {
      setQuantity(1);
    }
  };

  const tryAddCurrentProduct = (): boolean => {
    if (!product || !product.isAvailable) {
      return false;
    }

    if (width === "" || height === "") {
      return false;
    }

    if (
      curtainType === "panneau" &&
      !availablePanneauProducts.some((p) => p._id === selectedProductId)
    ) {
      return false;
    }

    addItem({
      productId: product.productId,
      productName: product.productName,
      productImage: product.productImage,
      quantity,
      width,
      height,
      curtainType,
    });

    resetProductFields();
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tryAddCurrentProduct()) {
      return;
    }
    success("Rideau ajouté. Vous pouvez en ajouter un autre ou continuer.");
  };

  const cartItemCount = getTotalItems();
  const formReadyToAdd =
    Boolean(product?.isAvailable) &&
    width !== "" &&
    height !== "" &&
    !(
      curtainType === "panneau" &&
      !availablePanneauProducts.some((p) => p._id === selectedProductId)
    );
  const canContinue = cartItemCount > 0 || formReadyToAdd;

  const handleContinueClick = () => {
    const added = tryAddCurrentProduct();
    if (!added && cartItemCount === 0) {
      return;
    }
    setShowContinueConfirm(true);
  };

  const handleConfirmOrder = () => {
    setShowContinueConfirm(false);
    void router.push("/paiement");
  };

  const handleKeepShopping = () => {
    setShowContinueConfirm(false);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(price);

  const orderTotal = getTotalPrice();
  const draftLineTotal = formReadyToAdd
    ? getCurtainLineTotal(curtainType, priceCalculation.total, quantity)
    : 0;
  const summaryTotal = orderTotal + draftLineTotal;

  const storePanelMeasurements = useMemo(() => {
    if (curtainType !== "store" || width === "" || height === "" || width <= 0 || height <= 0) {
      return [];
    }
    return getStorePanelMeasurements(width, height);
  }, [curtainType, width, height]);

  return (
    <>
      <Head>
        <title>Configurer votre rideau - Rideaux Bambou</title>
        <meta name="description" content="Configurez vos mesures avant la commande" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto grid max-w-5xl grid-cols-1 gap-3 px-3 py-5 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-2 lg:py-10">
          {isProductsLoading ? (
            <Card className="lg:col-span-2">
              <p className="text-gray-700 dark:text-gray-300">Chargement des références...</p>
            </Card>
          ) : (
            <>
              <Card className="h-fit">
                {product ? (
                  <>
                    <div className="relative mb-3 h-48 overflow-hidden rounded-lg bg-gray-100 sm:mb-4 sm:h-72 dark:bg-gray-700">
                      {product.productImage ? (
                        <Image
                          src={product.productImage}
                          alt={product.productName}
                          fill
                          className="object-cover"
                        />
                      ) : null}
                      {!product.isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/35">
                          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 shadow-sm dark:bg-gray-900/95 dark:text-red-300">
                            Hors stock
                          </span>
                        </div>
                      )}
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                      {product.productName}
                    </h1>
                    {!product.isAvailable && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {OUT_OF_STOCK_CLIENT_MESSAGE}. Choisissez une autre référence disponible pour
                        continuer votre commande.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-600">
                    <p className="text-base font-medium text-gray-700 dark:text-gray-200">
                      Choisir la référence
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Sélectionnez une référence pour afficher le visuel produit.
                    </p>
                  </div>
                )}
              </Card>

              <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Configuration produit
                    </h4>

                    <div>
                      <label className={formFieldLabelClass}>Référence</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className={`${formSelectClass} ${
                          selectedProductId === ""
                            ? "text-gray-400 dark:text-gray-400"
                            : "text-gray-900 dark:text-white"
                        }`}
                        disabled={isProductsLoading || productsForCurtainType.length === 0}
                      >
                        <option value="" className="text-gray-400">
                          Choisir la référence
                        </option>
                        {productsForCurtainType.map((item) => (
                          <option
                            key={item._id}
                            value={item._id}
                            disabled={item.isAvailable === false}
                          >
                            {item.name}
                            {item.isAvailable === false ? " — rupture de stock" : ""}
                          </option>
                        ))}
                      </select>
                      {curtainType === "panneau" &&
                        panneauProductsAll.length > 0 &&
                        panneauProductsAll.length < products.length && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            Références disponibles en panneau :{" "}
                            {panneauProductsAll.map((item) => item.name).join(", ")}
                          </p>
                        )}
                      {curtainType === "panneau" && panneauProductsAll.length === 0 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Aucune référence panneau configurée.
                        </p>
                      )}
                      {curtainType === "panneau" &&
                        productsForCurtainType.length > 0 &&
                        availableProductsForCurtainType.length === 0 && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            Toutes les références panneau sont en rupture de stock.
                          </p>
                        )}
                    </div>

                    <div>
                      <label className={formFieldLabelClass}>Type de rideau</label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <input
                            type="radio"
                            name="client-curtain-type"
                            value="panneau"
                            checked={curtainType === "panneau"}
                            onChange={() => setCurtainType("panneau")}
                            className="sr-only"
                          />
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                            <span
                              className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                curtainType === "panneau" ? "opacity-100" : "opacity-0"
                              }`}
                            />
                          </span>
                          Panneau
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                          <input
                            type="radio"
                            name="client-curtain-type"
                            value="store"
                            checked={curtainType === "store"}
                            onChange={() => setCurtainType("store")}
                            className="sr-only"
                          />
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                            <span
                              className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                curtainType === "store" ? "opacity-100" : "opacity-0"
                              }`}
                            />
                          </span>
                          Store
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={formFieldLabelClass}>Largeur (cm)</label>
                        {curtainType === "panneau" ? (
                          <select
                            value={width}
                            onChange={(e) =>
                              setWidth(e.target.value ? Number(e.target.value) : "")
                            }
                            className={formSelectClass}
                            style={{
                              color: width === "" ? "#9CA3AF" : undefined,
                            }}
                          >
                            <option value="" style={{ color: "#9CA3AF" }}>
                              Choisir la largeur
                            </option>
                            {panneauConfig.widths.map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.widthCm}
                                style={{ color: isDarkMode ? "#FFFFFF" : "#111827" }}
                              >
                                {formatPanneauWidthOption(entry)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={storeWidthInput}
                            onChange={(e) => {
                              const nextInput = sanitizeMeasurementInput(e.target.value);
                              const parsed = parseMeasurement(nextInput);

                              if (nextInput === "" || Number.isNaN(parsed)) {
                                setStoreWidthInput(nextInput);
                                setWidth("");
                                return;
                              }

                              if (parsed > MAX_STORE_WIDTH_CM) {
                                setStoreWidthInput(formatMeasurement(MAX_STORE_WIDTH_CM));
                                setWidth(MAX_STORE_WIDTH_CM);
                                return;
                              }

                              setStoreWidthInput(nextInput);
                              setWidth(parsed > 0 ? parsed : "");
                            }}
                            placeholder="ex. 120,5"
                            className={formNumberFieldClass}
                          />
                        )}
                      </div>
                      <div>
                        <label className={formFieldLabelClass}>Hauteur (cm)</label>
                        {curtainType === "panneau" ? (
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
                            value={height === "" ? "" : String(height)}
                            onChange={(e) => {
                              const sanitized = sanitizeMeasurementInput(e.target.value);
                              if (sanitized === "") {
                                setHeight("");
                                return;
                              }
                              const parsed = parseMeasurement(sanitized);
                              if (!Number.isNaN(parsed)) {
                                setHeight(parsed);
                              }
                            }}
                            placeholder="ex. 200"
                            className={formNumberFieldClass}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className={formFieldLabelClass}>Quantité</label>
                      <div className="flex flex-wrap items-center justify-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          readOnly
                          className="w-9 rounded-md border border-gray-300 px-0 py-1 text-center text-xs font-medium leading-none focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                          style={{ textAlign: "center" }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          +
                        </button>
                      </div>
                      {curtainType === "store" && storePanelMeasurements.length === 0 && (
                        <StorePanelQuantityHint />
                      )}
                    </div>

                    {curtainType === "store" && storePanelMeasurements.length > 0 && (
                      <StorePanelBreakdown panels={storePanelMeasurements} compact />
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={
                          height === "" ||
                          width === "" ||
                          !product ||
                          !product.isAvailable
                        }
                      >
                        {product && !product.isAvailable
                          ? OUT_OF_STOCK_CLIENT_MESSAGE
                          : "Ajouter rideau"}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Résumé de la commande
                      </h4>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
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
                                {formatPrice(
                                  getCurtainLineTotal(
                                    item.curtainType,
                                    item.calculation.total,
                                    item.quantity
                                  )
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                                aria-label="Retirer ce produit"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {formReadyToAdd && product ? (
                          <div className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {product.productName}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">
                                {width}cm × {height}cm ·{" "}
                                {curtainType === "panneau" ? "Panneau" : "Store"} · Qté{" "}
                                {quantity}
                              </p>
                            </div>
                            <span className="shrink-0 text-gray-900 dark:text-white">
                              {formatPrice(draftLineTotal)}
                            </span>
                          </div>
                        ) : null}

                        {(items.length > 0 || formReadyToAdd) && (
                          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                            <div className="flex justify-between text-lg font-semibold">
                              <span className="text-gray-900 dark:text-white">Total</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatPrice(summaryTotal)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      className="min-w-[10rem]"
                      disabled={!canContinue}
                      onClick={handleContinueClick}
                    >
                      Continuer{cartItemCount > 0 ? ` (${cartItemCount})` : ""}
                    </Button>
                  </div>
                </form>
              </Card>
            </>
          )}
        </main>

        {showContinueConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
              onClick={handleKeepShopping}
              aria-label="Fermer la confirmation"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="continue-order-confirm-title"
              className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <h3
                id="continue-order-confirm-title"
                className="text-center text-lg font-semibold text-gray-900 dark:text-white"
              >
                Confirmer la commande ?
              </h3>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                Êtes-vous sûr de vouloir commander maintenant, ou préférez-vous continuer vos
                achats et ajouter d&apos;autres rideaux ?
              </p>
              <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                <Button type="button" variant="secondary" onClick={handleKeepShopping}>
                  Continuer mes achats
                </Button>
                <Button
                  type="button"
                  className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  onClick={handleConfirmOrder}
                >
                  Oui, commander
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
