import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";

import { useSimpleCart } from "../contexts/SimpleCartContext";
import { getCurtainLineTotal } from "../lib/order-pricing";
import { OUT_OF_STOCK_CLIENT_MESSAGE } from "../lib/product-availability-sync";
import { usePublicProductsQuery } from "../lib/products-query";

function formatPrice(price: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
  }).format(price);
}

/** Mini-cart dropdown under the nav cart icon */
export default function CartPopover() {
  const router = useRouter();
  const {
    items,
    isCartOpen,
    closeCart,
    removeItem,
    getTotalItems,
    getTotalPrice,
  } = useSimpleCart();

  const { data: productsData } = usePublicProductsQuery();

  const availableProductIds = useMemo(
    () =>
      new Set(
        (Array.isArray(productsData) ? productsData : [])
          .filter((product) => product.isAvailable)
          .map((product) => product._id)
      ),
    [productsData]
  );

  const hasUnavailableItems = useMemo(
    () => items.some((item) => !availableProductIds.has(item.productId)),
    [items, availableProductIds]
  );

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCartOpen, closeCart]);

  useEffect(() => {
    const handleRouteChange = () => closeCart();
    router.events.on("routeChangeStart", handleRouteChange);
    return () => router.events.off("routeChangeStart", handleRouteChange);
  }, [router.events, closeCart]);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="dialog"
          aria-label="Aperçu du panier"
          className="absolute right-0 z-[80] mt-2 w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-gray-900/15 ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/40 dark:ring-white/5"
        >
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Panier</p>
            {items.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getTotalItems()} article{getTotalItems() > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Votre panier est vide
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Ajoutez un produit pour commencer.
              </p>
              <Link
                href="/#boutique"
                onClick={closeCart}
                className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Voir la boutique
              </Link>
            </div>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto">
                {hasUnavailableItems && (
                  <div className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                    Un article est en {OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}.
                  </div>
                )}

                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item) => {
                    const unavailable = !availableProductIds.has(item.productId);
                    const unitPrice = item.calculation.total;
                    const lineTotal = getCurtainLineTotal(
                      item.curtainType,
                      item.calculation.total,
                      item.quantity
                    );

                    return (
                      <li key={item.id} className="flex gap-3 px-4 py-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                          <Image
                            src={item.productImage}
                            alt={item.productName}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                {item.productName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {item.curtainType === "panneau" ? "Panneau" : "Store"} · {item.width}
                                ×{item.height} cm
                              </p>
                              {unavailable && (
                                <p className="mt-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                                  {OUT_OF_STOCK_CLIENT_MESSAGE}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              aria-label={`Retirer ${item.productName}`}
                              title="Retirer"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>

                          <div className="mt-1.5 flex items-baseline justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              × {item.quantity}
                              {item.curtainType !== "store" && (
                                <span className="text-gray-400"> · {formatPrice(unitPrice)}</span>
                              )}
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                              {formatPrice(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Total</span>
                  <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
                <Link
                  href="/panier"
                  onClick={closeCart}
                  className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                >
                  Voir le panier
                </Link>
                <Link
                  href="/paiement"
                  onClick={(event) => {
                    if (hasUnavailableItems) {
                      event.preventDefault();
                      return;
                    }
                    closeCart();
                  }}
                  aria-disabled={hasUnavailableItems}
                  className={`flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 ${
                    hasUnavailableItems ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Valider la commande
                </Link>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
