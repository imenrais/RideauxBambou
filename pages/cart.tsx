import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCart, CartItem } from "../contexts/CartContext";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import BackButton from "../components/BackButton";
import { useQuery } from "@tanstack/react-query";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";

export default function CartPage() {
  const {
    items,
    removeItem,
    clearCart,
    getTotalPrice,
    getItemCount,
    wantsInstallation,
    setWantsInstallation,
  } = useCart();

  // Fetch installation fee
  const { data: installationFeeData } = useQuery({
    queryKey: ["installation-fee"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/installation-fee");
        const data = await response.json();
        return data.success ? data.data : { fee: 11 };
      } catch (error) {
        console.error("Error fetching installation fee:", error);
        return { fee: 11 };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
  };

  const handleClearCart = () => {
    clearCart();
  };

  const handleCheckout = () => {
    window.location.href = "/checkout";
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "TND",
    }).format(price);
  };

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
              <p className="text-gray-600 dark:text-gray-400">
                {getItemCount()} article{getItemCount() > 1 ? "s" : ""} dans votre panier
              </p>
            </motion.div>

            {items.length === 0 ? (
              /* Empty Cart */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="py-12 text-center"
              >
                <div className="mb-4 text-6xl">🛒</div>
                <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
                  Votre panier est vide
                </h2>
                <p className="mb-8 text-gray-600 dark:text-gray-400">
                  Découvrez notre collection de rideaux en bambou
                </p>
                <Link
                  href="/#boutique"
                  className="inline-flex items-center rounded-md border border-transparent bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-base font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Voir nos produits
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
                          <div className="flex-1">
                            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                              {item.curtainTypeName}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              <p>Largeur: {item.width} cm</p>
                              <p>Hauteur: {item.height} cm</p>
                              <p>Surface: {item.calculation.area.toFixed(2)} m²</p>
                              <p>Prix: {formatPrice(item.calculation.total)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="ml-4 p-2 text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
                          {getItemCount()} article{getItemCount() > 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatPrice(getTotalPrice())}
                        </span>
                      </div>

                      {/* Installation Option */}
                      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="installation-option"
                              checked={wantsInstallation}
                              onChange={(e) => setWantsInstallation(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <label
                              htmlFor="installation-option"
                              className="text-sm font-medium text-gray-900 dark:text-white"
                            >
                              Installation professionnelle
                            </label>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {wantsInstallation
                              ? formatPrice(installationFeeData?.fee || 11)
                              : "Gratuite"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Nos experts installent vos rideaux pour un rendu parfait
                        </p>
                      </div>

                      {wantsInstallation && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Frais d'installation
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatPrice(installationFeeData?.fee || 11)}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                        <div className="flex justify-between text-lg font-semibold">
                          <span className="text-gray-900 dark:text-white">Total</span>
                          <span className="text-green-600 dark:text-green-400">
                            {formatPrice(
                              getTotalPrice() +
                                (wantsInstallation ? installationFeeData?.fee || 11 : 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCheckout}
                      className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
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
