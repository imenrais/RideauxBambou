import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import BackButton from "../components/BackButton";

interface OrderDetails {
  orderId: string;
  totalAmount: number;
  deliveryFee: number;
  installationFee: number;
  wantsInstallation: boolean;
  itemCount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
}

export default function OrderSuccessPage() {
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);

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

  return (
    <>
      <Head>
        <title>Commande confirmée - Rideaux Bambou</title>
        <meta name="description" content="Votre commande a été confirmée avec succès" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6">
            <BackButton href="/#boutique" />
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
                <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                  <p>
                    <strong>Commande:</strong> #{orderDetails.orderId.slice(-8)}
                  </p>
                  <p>
                    <strong>Articles:</strong> {orderDetails.itemCount}
                  </p>
                  <p>
                    <strong>Total:</strong> {formatPrice(orderDetails.totalAmount)}
                  </p>
                  <p>
                    <strong>Livraison:</strong> {formatPrice(orderDetails.deliveryFee)}
                  </p>
                  <p>
                    <strong>Installation:</strong>{" "}
                    {orderDetails.wantsInstallation
                      ? formatPrice(orderDetails.installationFee)
                      : "Non demandée"}
                  </p>
                  <p>
                    <strong>Client:</strong> {orderDetails.customerName}
                  </p>
                  <p>
                    <strong>Téléphone:</strong> {orderDetails.customerPhone}
                  </p>
                  <p>
                    <strong>Email:</strong> {orderDetails.customerEmail}
                  </p>
                </div>
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <strong>Adresse:</strong> {orderDetails.address}
                </p>
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
                className="inline-flex items-center rounded-md border border-transparent bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-base font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Continuer mes achats
              </Link>
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Retour à l'accueil
              </Link>
            </motion.div>
          </motion.div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
