import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useSimpleCart } from "../contexts/SimpleCartContext";

interface Product {
  _id: string;
  name: string;
  image: string;
}

const STORE_WIDTH_MAX = 210;

export default function ConfigurerProduitPage() {
  const router = useRouter();
  const { addItem, calculatePrice } = useSimpleCart();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">(210);
  const [curtainType, setCurtainType] = useState<"panneau" | "store">("panneau");
  const [quantity, setQuantity] = useState(1);
  const [wantsInstallation, setWantsInstallation] = useState<boolean | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [priceCalculation, setPriceCalculation] = useState({ area: 0, pricePerM2: 0, total: 0 });
  const [storeWidthError, setStoreWidthError] = useState("");

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ["products-configurer"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      const data = await response.json();
      return data.success ? (data.data as Product[]) : [];
    },
  });

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

  const products = Array.isArray(productsData) ? productsData : [];
  const initialProductId =
    typeof router.query.productId === "string" ? router.query.productId : undefined;

  useEffect(() => {
    if (!products.length) {
      return;
    }

    if (selectedProductId) {
      return;
    }

    const queryProductExists = initialProductId && products.some((p) => p._id === initialProductId);
    setSelectedProductId(queryProductExists ? initialProductId : products[0]._id);
  }, [products, initialProductId, selectedProductId]);

  const product = useMemo(() => {
    if (!products.length || !selectedProductId) {
      return null;
    }

    const selected = products.find((p) => p._id === selectedProductId);
    if (!selected) {
      return null;
    }

    return {
      productId: selected._id,
      productName: selected.name,
      productImage: selected.image || "/14.jpeg",
    };
  }, [products, selectedProductId]);

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
      setHeight(210);
      setWidth((prevWidth) => (prevWidth === 100 || prevWidth === 130 ? prevWidth : ""));
      setStoreWidthError("");
      return;
    }

    setHeight((prevHeight) => (prevHeight === 210 ? "" : prevHeight));
    setWidth((prevWidth) => (prevWidth === 100 || prevWidth === 130 ? "" : prevWidth));
  }, [curtainType]);

  useEffect(() => {
    if (width === "" || height === "" || width <= 0 || height <= 0) {
      setPriceCalculation({ area: 0, pricePerM2: 0, total: 0 });
      return;
    }

    const calculation = calculatePrice(width, height);
    setPriceCalculation(calculation);
  }, [width, height, calculatePrice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) {
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
      pathname: "/checkout",
      query: { install: wantsInstallation ? "yes" : "no" },
    });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(price);

  const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
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
          ) : !product ? (
            <Card className="lg:col-span-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Produit introuvable
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Merci de revenir a la section Nos Produits puis cliquer sur Acheter maintenant.
              </p>
              <div className="mt-5">
                <Button onClick={() => router.push("/#boutique")}>Retour aux produits</Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="h-fit">
                <div className="relative mb-4 h-56 overflow-hidden rounded-lg bg-gray-100 sm:h-72 dark:bg-gray-700">
                  <Image src={product.productImage} alt={product.productName} fill className="object-cover" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.productName}</h1>
              </Card>

              <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Référence
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      {products.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Largeur (cm)
                      </label>
                      {curtainType === "panneau" ? (
                        <select
                          value={width}
                          onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : "")}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          style={{
                            color: width === "" ? "#9CA3AF" : undefined,
                          }}
                          required
                        >
                          <option value="" style={{ color: "#9CA3AF" }}>
                            Choisir la largeur
                          </option>
                          <option value={100} style={{ color: isDarkMode ? "#FFFFFF" : "#111827" }}>
                            1m (100cm)
                          </option>
                          <option value={130} style={{ color: isDarkMode ? "#FFFFFF" : "#111827" }}>
                            1m30 (130cm)
                          </option>
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
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                      {curtainType === "panneau" && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Largeurs disponibles: 100 cm ou 130 cm uniquement.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Hauteur (cm)
                      </label>
                      {curtainType === "panneau" ? (
                        <input
                          type="number"
                          value={210}
                          disabled
                          className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                          required
                        />
                      )}
                      {curtainType === "panneau" && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Hauteur fixe pour panneau: 210 cm.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                        className="w-10 rounded-md border border-gray-300 px-0 py-1.5 text-center text-sm font-medium leading-none focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        style={{ textAlign: "center" }}
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
                        <span>Prix par m²:</span>
                        <span>{formatPrice(priceCalculation.pricePerM2)}</span>
                      </div>
                      {wantsInstallation === true && (
                        <div className="flex justify-between text-sm">
                          <span>Frais d&apos;installation</span>
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

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push("/#boutique")}
                      className="w-full sm:flex-1"
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={wantsInstallation === null || isStoreWidthInvalid || height === ""}
                      className="w-full bg-green-600 hover:bg-green-700 sm:flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Continuer
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
