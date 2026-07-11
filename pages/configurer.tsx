import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PriceDisplay from "../components/ui/PriceDisplay";
import { useSimpleCart } from "../contexts/SimpleCartContext";
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

interface Product {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
  supportsPanneau?: boolean;
}

const STORE_WIDTH_MAX = 210;

export default function ConfigurerProduitPage() {
  const router = useRouter();
  const { addItem, calculatePrice, storePriceSettings, panneauConfig, pricesLoaded } = useSimpleCart();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [curtainType, setCurtainType] = useState<"panneau" | "store">("panneau");
  const [quantity, setQuantity] = useState(1);
  const [wantsInstallation, setWantsInstallation] = useState<boolean | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const hasInitializedSelectionRef = useRef(false);
  const [priceCalculation, setPriceCalculation] = useState({ area: 0, pricePerM2: 0, total: 0 });
  const [storeWidthError, setStoreWidthError] = useState("");

  const { data: productsData, isLoading: isProductsLoading } = usePublicProductsQuery();

  const { data: installationFeeData } = useQuery({
    queryKey: ["installation-fee-configurer"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/installation-fee");
        const data = await response.json();
        return data.success ? data.data : { fee: 11 };
      } catch {
        return { fee: 11 };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
    if (!router.isReady || isProductsLoading || hasInitializedSelectionRef.current) {
      return;
    }

    if (!products.length) {
      return;
    }

    const queryProduct = queryProductId
      ? products.find((product) => product._id === queryProductId)
      : undefined;

    if (queryProduct) {
      setCurtainType(queryProduct.supportsPanneau === true ? "panneau" : "store");
      setSelectedProductId(queryProduct._id);
    } else if (availablePanneauProducts.length > 0) {
      setCurtainType("panneau");
      setSelectedProductId(availablePanneauProducts[0]._id);
    } else if (availableStoreProducts.length > 0) {
      setCurtainType("store");
      setSelectedProductId(availableStoreProducts[0]._id);
    } else {
      setCurtainType("store");
      setSelectedProductId(products[0]?._id ?? "");
    }

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

    if (
      curtainType === "store" &&
      queryProductId &&
      productsForCurtainType.some((product) => product._id === queryProductId)
    ) {
      setSelectedProductId(queryProductId);
      return;
    }

    const fallbackProduct =
      availableProductsForCurtainType[0] ?? productsForCurtainType[0] ?? null;
    setSelectedProductId(fallbackProduct?._id ?? "");
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
      productImage: selectedProduct.image || "/14.jpeg",
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
      setStoreWidthError("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !product.isAvailable) {
      return;
    }

    if (width === "") {
      return;
    }
    if (height === "") {
      return;
    }
    if (curtainType === "store" && width > STORE_WIDTH_MAX) {
      return;
    }
    if (
      curtainType === "panneau" &&
      !availablePanneauProducts.some((p) => p._id === selectedProductId)
    ) {
      return;
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

    void router.push({
      pathname: "/paiement",
      query: { install: wantsInstallation ? "yes" : "no" },
    });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(price);

  const isStoreWidthInvalid = curtainType === "store" && typeof width === "number" && width > STORE_WIDTH_MAX;

  return (
    <>
      <Head>
        <title>Configurer votre rideau - Rideaux Bambou</title>
        <meta name="description" content="Configurez vos mesures avant la commande" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-6 sm:gap-6 sm:py-10 lg:grid-cols-2">
          {isProductsLoading ? (
            <Card className="lg:col-span-2">
              <p className="text-gray-700 dark:text-gray-300">Chargement des références...</p>
            </Card>
          ) : (
            <>
              <Card className="h-fit">
                {product ? (
                  <>
                    <div className="relative mb-4 h-56 overflow-hidden rounded-lg bg-gray-100 sm:h-72 dark:bg-gray-700">
                      <Image
                        src={product.productImage}
                        alt={product.productName}
                        fill
                        className={`object-cover ${product.isAvailable ? "" : "grayscale"}`}
                      />
                      {!product.isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40 px-4 text-center">
                          <span className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm dark:bg-gray-900/95 dark:text-red-300">
                            {OUT_OF_STOCK_CLIENT_MESSAGE}
                          </span>
                        </div>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
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
                  <div>
                    <label className={formFieldLabelClass}>
                      Référence
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className={formSelectClass}
                      required
                    >
                      {productsForCurtainType.map((item) => (
                        <option
                          key={item._id}
                          value={item._id}
                          disabled={!item.isAvailable}
                        >
                          {item.name}
                          {!item.isAvailable ? ` — ${OUT_OF_STOCK_CLIENT_MESSAGE}` : ""}
                        </option>
                      ))}
                    </select>
                    {curtainType === "panneau" && productsForCurtainType.length === 0 && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Aucune référence panneau configurée.
                      </p>
                    )}
                    {curtainType === "panneau" &&
                      productsForCurtainType.length > 0 &&
                      availableProductsForCurtainType.length === 0 && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Toutes les références panneau sont en {OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}.
                        </p>
                      )}
                  </div>

                  <div>
                    <label className={formFieldLabelClass}>
                      Type de rideau
                    </label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          value="panneau"
                          checked={curtainType === "panneau"}
                          onChange={(e) => setCurtainType(e.target.value as "panneau" | "store")}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                          <span
                            className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                              curtainType === "panneau" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        <span className="text-sm">Panneau</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          value="store"
                          checked={curtainType === "store"}
                          onChange={(e) => setCurtainType(e.target.value as "panneau" | "store")}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                          <span
                            className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                              curtainType === "store" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        <span className="text-sm">Store</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={formFieldLabelClass}>
                        Largeur (cm)
                      </label>
                      {curtainType === "panneau" ? (
                        <select
                          value={width}
                          onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : "")}
                          className={formSelectClass}
                          style={{
                            color: width === "" ? "#9CA3AF" : undefined,
                          }}
                          required
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
                          type="number"
                          min={1}
                          max={STORE_WIDTH_MAX}
                          value={width}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setWidth("");
                              setStoreWidthError("");
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) {
                              return;
                            }
                            setWidth(parsed);
                            if (parsed > STORE_WIDTH_MAX) {
                              setStoreWidthError(
                                `La largeur ne peut pas dépasser ${STORE_WIDTH_MAX} cm.`
                              );
                            } else {
                              setStoreWidthError("");
                            }
                          }}
                          className={formNumberFieldClass}
                          required
                        />
                      )}
                      {curtainType !== "panneau" && (
                        <>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Largeur maximale: {STORE_WIDTH_MAX} cm.
                          </p>
                          {storeWidthError && (
                            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                              {storeWidthError}
                            </p>
                          )}
                        </>
                      )}
                      {curtainType === "panneau" && panneauConfig.widths.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Largeurs disponibles:{" "}
                          {panneauConfig.widths.map((entry) => `${entry.widthCm} cm`).join(", ")}.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={formFieldLabelClass}>
                        Hauteur (cm)
                      </label>
                      {curtainType === "panneau" ? (
                        <input
                          type="number"
                          value={panneauConfig.fixedHeightCm}
                          disabled
                          className={formFieldDisabledClass}
                        />
                      ) : (
                        <input
                          type="number"
                          min={1}
                          value={height}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setHeight("");
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) {
                              return;
                            }
                            setHeight(parsed);
                          }}
                          className={formNumberFieldClass}
                          required
                        />
                      )}
                      {curtainType === "panneau" && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Hauteur fixe pour panneau: {panneauConfig.fixedHeightCm} cm.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={formFieldLabelClass}>
                      Pose
                    </label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          name="pose"
                          checked={wantsInstallation === true}
                          onChange={() => setWantsInstallation(true)}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                          <span
                            className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                              wantsInstallation === true ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        <span className="text-sm">Oui</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          name="pose"
                          checked={wantsInstallation === false}
                          onChange={() => setWantsInstallation(false)}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                          <span
                            className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                              wantsInstallation === false ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        <span className="text-sm">Non</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={formFieldLabelClass}>
                      Quantite
                    </label>
                    <div className="flex flex-wrap items-center justify-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        readOnly
                        className="h-8 w-10 rounded-md border border-gray-300 px-0 text-center text-sm font-medium leading-none [text-align-last:center] focus:outline-none [-moz-appearance:textfield] dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex justify-between">
                        <span>
                          {curtainType === "panneau" ? "Prix:" : "Prix par m²:"}
                        </span>
                        <span>
                          {curtainType === "panneau" ? (
                            (() => {
                              const selectedWidth = panneauConfig.widths.find(
                                (entry) => entry.widthCm === width
                              );

                              if (!selectedWidth) {
                                return formatPrice(priceCalculation.total);
                              }

                              return (
                                <PriceDisplay
                                  pricePerM2={selectedWidth.price}
                                  salePricePerM2={selectedWidth.salePrice}
                                  isSaleActive={panneauConfig.isSaleActive === true}
                                  suffix=""
                                  inline
                                  listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                                  saleClassName="text-sm font-semibold text-green-600 dark:text-green-400"
                                />
                              );
                            })()
                          ) : (
                            <PriceDisplay
                              pricePerM2={storePriceSettings.pricePerM2}
                              salePricePerM2={storePriceSettings.salePricePerM2}
                              isSaleActive={storePriceSettings.isSaleActive === true}
                              suffix=""
                              inline
                              listClassName="text-sm text-gray-500 line-through dark:text-gray-400"
                              saleClassName="text-sm font-semibold text-green-600 dark:text-green-400"
                            />
                          )}
                        </span>
                      </div>
                      {wantsInstallation === true && (
                        <div className="flex justify-between text-sm">
                          <span>Frais de pose</span>
                          <span>{formatPrice(installationFeeData?.fee || 11)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                        <span>Total</span>
                        <span>
                          {formatPrice(
                            priceCalculation.total * quantity +
                              (wantsInstallation ? installationFeeData?.fee || 11 : 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={
                        wantsInstallation === null ||
                        isStoreWidthInvalid ||
                        height === "" ||
                        !product ||
                        !product.isAvailable
                      }
                      className="w-full bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {product && !product.isAvailable
                        ? OUT_OF_STOCK_CLIENT_MESSAGE
                        : "Continuer"}
                    </Button>
                  </div>
                </form>
              </Card>
            </>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
