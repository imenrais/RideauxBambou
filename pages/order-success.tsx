import { motion } from "framer-motion";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import BackButton from "../components/BackButton";
import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import type { CustomerType } from "../lib/customer-info";
import {
  calculateOrderInvoiceTotals,
  getOrderSummaryLines,
} from "../lib/invoice-totals";

interface OrderDetails {
  orderId: string;
  totalAmount: number;
  deliveryFee?: number;
  installationFee?: number;
  itemCount: number;
  customerType?: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  customerName?: string;
  customerPhone: string;
  customerEmail?: string;
}

const getCustomerNameLabel = (orderDetails: OrderDetails) =>
  orderDetails.customerType === "company" ? "Nom de l'entreprise" : "Prénom et nom";

const getCustomerNameValue = (orderDetails: OrderDetails) => {
  if (orderDetails.customerType === "company") {
    return orderDetails.companyName?.trim() || "";
  }

  const fullName = `${orderDetails.firstName || ""} ${orderDetails.lastName || ""}`.trim();
  return fullName || orderDetails.customerName?.trim() || "";
};

export default function OrderSuccessPage() {
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const handleBackNavigation = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    void router.push("/");
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("last-order-details");
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as OrderDetails;
      setOrderDetails(parsed);
      sessionStorage.removeItem("last-order-details");
    } catch (error) {
      console.error("Failed to parse last-order-details:", error);
    }
  }, [router.asPath]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "TND",
    }).format(price);
  };

  const customerEmail = orderDetails?.customerEmail?.trim() || "";
  const showEmail =
    Boolean(customerEmail) &&
    customerEmail.toLowerCase() !== "non renseigné";
  const invoiceTotals = orderDetails
    ? calculateOrderInvoiceTotals({
        totalAmount: orderDetails.totalAmount,
        deliveryFee: orderDetails.deliveryFee ?? 0,
        installationFee: orderDetails.installationFee ?? 0,
        customerInfo: { customerType: orderDetails.customerType },
      })
    : null;
  const invoiceSummaryLines = invoiceTotals
    ? getOrderSummaryLines(invoiceTotals, { regionSelected: true })
    : [];

  return (
    <>
      <Head>
        <title>Commande confirmée - Rideaux Bambou</title>
        <meta name="description" content="Votre commande a été confirmée avec succès" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/logo.jpeg" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6">
            <BackButton />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
            >
              <svg
                className="h-10 w-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>

            {/* Success Message */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-4 text-3xl font-bold text-gray-900 dark:text-white"
            >
              Commande confirmée !
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mb-8 text-lg text-gray-600 dark:text-gray-400"
            >
              Merci pour votre commande. Nous avons reçu votre demande et vous contacterons bientôt
              pour finaliser les détails.
            </motion.p>

            {/* Order Details */}
            {orderDetails && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6 }}
                className="mb-8 rounded-lg border border-green-200 bg-green-50 p-6 text-left dark:border-green-800/50 dark:bg-green-900/20"
              >
                <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                  Détails de votre commande
                </h2>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>Commande :</strong> #{orderDetails.orderId.slice(-8)}
                  </p>
                  <p>
                    <strong>{getCustomerNameLabel(orderDetails)} :</strong>{" "}
                    {getCustomerNameValue(orderDetails)}
                  </p>
                  <p>
                    <strong>Téléphone :</strong> {orderDetails.customerPhone}
                  </p>
                  {showEmail && (
                    <p>
                      <strong>Email :</strong> {customerEmail}
                    </p>
                  )}
                  <p>
                    <strong>Articles :</strong> {orderDetails.itemCount}
                  </p>
                  <div className="space-y-2 border-t border-green-200 pt-3 dark:border-green-800/50">
                    {invoiceSummaryLines.map((line) => (
                      <p
                        key={line.label}
                        className={line.emphasis ? "text-base font-semibold text-gray-900 dark:text-white" : ""}
                      >
                        <strong>{line.label} :</strong>{" "}
                        {line.displayText ?? formatPrice(line.amount)}
                      </p>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mb-8 rounded-lg bg-gray-50 p-6 dark:bg-gray-800"
            >
              <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                Prochaines étapes
              </h2>
              <div className="space-y-3 text-left">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        1
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Confirmation :</strong> Nous vous contacterons dans les 24h pour
                      confirmer votre commande.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        2
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Fabrication :</strong> Vos rideaux seront fabriqués sur mesure selon
                      vos dimensions.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        3
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Livraison :</strong> Nous vous contacterons pour organiser la
                      livraison.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-col justify-center gap-4 sm:flex-row"
            >
              <Link
                href="/#boutique"
                className="inline-flex items-center rounded-md border border-transparent bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Continuer mes achats
              </Link>
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Retour à l&apos;accueil
              </button>
            </motion.div>
          </motion.div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
