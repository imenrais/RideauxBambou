import { motion } from "framer-motion";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import BackButton from "../components/BackButton";
import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import Loading from "../components/ui/Loading";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { usePublicProductsQuery } from "../lib/products-query";
import { OUT_OF_STOCK_CLIENT_MESSAGE } from "../lib/product-availability-sync";

export default function SimpleCartPage() {
  const {
    items,
    removeItem,
    clearCart,
    updateQuantity,
    getItemCount,
    getTotalItems,
    getTotalPrice,
    isLoading,
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
  const unavailableItems = useMemo(
    () => items.filter((item) => !availableProductIds.has(item.productId)),
    [items, availableProductIds]
  );
  const hasUnavailableItems = unavailableItems.length > 0;

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
  };

  const handleClearCart = () => {
    clearCart();
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  };

  const handleCheckout = () => {
    window.location.href = "/paiement";
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "TND",
    }).format(price);
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading cart..." />;
  }

  return (
    <>
      <Head>
        <title>Panier - Rideaux Bambou</title>
        <meta name="description" content="Votre panier de rideaux en bambou" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
              <BackButton href="/#boutique" />
            </div>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                Votre Panier
              </h1>
              {items.length > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  {getItemCount()} article{getItemCount() > 1 ? "s" : ""} dans votre panier
                </p>
              )}
            </motion.div>

            {hasUnavailableItems && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                Certains articles sont en {OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}. Retirez-les ou remplacez-les avant de continuer vers le paiement.
              </div>
            )}

            {items.length === 0 ? (
              /* Empty Cart */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-5 text-6xl">🛒</div>
                <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                  Votre panier est vide
                </h2>
                <p className="mb-8 text-gray-600 dark:text-gray-400">
                  Ajoutez vos produits, dimensions et quantités pour continuer votre commande.
                </p>
                <Link
                  href="/#boutique"
                  className="inline-flex items-center rounded-md border border-transparent bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-base font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Découvrir nos produits
                </Link>
              </motion.div>
            ) : (
              /* Cart Items */
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Cart Items */}
                <div className="lg:col-span-2">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="space-y-4"
                  >
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 * index }}
                        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-1 space-x-4">
                            {/* Product Image */}
                            <div className="relative h-20 w-20 flex-shrink-0">
                              <Image
                                src={item.productImage}
                                alt={item.productName}
                                fill
                                className="rounded-lg object-cover"
                              />
                            </div>

                            {/* Product Details */}
                            <div className="flex-1">
                              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                                {item.productName}
                              </h3>
                              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                <p>Type: {item.curtainType === "panneau" ? "Panneau" : "Store"}</p>
                                <p>
                                  Dimensions: {item.width}cm × {item.height}cm
                                </p>
                                <p>Surface: {item.calculation.area} m²</p>
                                <p>Prix: {formatPrice(item.calculation.total)}</p>
                                <p>Quantité: {item.quantity}</p>
                                {!availableProductIds.has(item.productId) && (
                                  <p className="font-medium text-red-600 dark:text-red-400">
                                    {OUT_OF_STOCK_CLIENT_MESSAGE}
                                  </p>
                                )}
                                <p className="font-semibold text-green-600 dark:text-green-400">
                                  {formatPrice(item.calculation.total * item.quantity)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls and Remove Button */}
                          <div className="flex flex-col items-end space-y-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                className="rounded-full bg-gray-200 p-1 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 12H4"
                                  />
                                </svg>
                              </button>
                              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-center text-sm font-medium dark:border-gray-600 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                className="rounded-full bg-gray-200 p-1 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              title="Supprimer du panier"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Clear Cart Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-6"
                  >
                    <button
                      onClick={handleClearCart}
                      className="text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Vider le panier
                    </button>
                  </motion.div>
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="sticky top-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                      Résumé de la commande
                    </h2>

                    <div className="mb-6 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {getTotalItems()} article{getTotalItems() > 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatPrice(getTotalPrice())}
                        </span>
                      </div>

                      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                        <div className="flex justify-between text-lg font-semibold">
                          <span className="text-gray-900 dark:text-white">Total</span>
                          <span className="text-green-600 dark:text-green-400">
                            {formatPrice(getTotalPrice())}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={hasUnavailableItems}
                      className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Commander
                    </button>

                    <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                      * Les prix incluent la TVA
                    </p>
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
