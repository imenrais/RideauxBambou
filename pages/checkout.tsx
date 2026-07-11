import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { useToast } from "../contexts/ToastContext";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";
import { getPhoneValidationError, normalizePhoneValue } from "../lib/phone-validation";
import { usePublicProductsQuery } from "../lib/products-query";
import { OUT_OF_STOCK_CLIENT_MESSAGE } from "../lib/product-availability-sync";
import {
  getCitiesForGovernorate,
  GOVERNORATE_CODE_MAP,
  resolveGovernorateName,
  TUNISIAN_GOVERNORATES,
  normalizeGovernorate,
} from "../lib/tunisia-locations";
import {
  formFieldClass,
  formFieldLabelClass,
  formSelectClass,
  formSelectDisabledClass,
  formTextareaClass,
} from "../lib/form-field-styles";

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    isLoading: cartLoading,
    getTotalPrice,
    clearCart,
  } = useSimpleCart();
  const [wantsInstallation, setWantsInstallation] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const { error: showError } = useToast();
  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  });

  const { data: productsData } = usePublicProductsQuery();

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

  // Fetch delivery fees
  const { data: deliveryFees } = useQuery({
    queryKey: ["delivery-fees"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/delivery-fees");
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        console.error("Error fetching delivery fees:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Get current delivery fee based on selected state
  const normalizedSelectedState = normalizeGovernorate(formData.state);
  const selectedStateCode =
    GOVERNORATE_CODE_MAP[normalizedSelectedState] ||
    (formData.state.trim().length === 2 ? formData.state.trim().toUpperCase() : "");
  const currentDeliveryFee =
    deliveryFees?.find(
      (fee: any) =>
        normalizeGovernorate(fee.state) === normalizedSelectedState ||
        fee.stateCode === selectedStateCode
    )?.fee || 0;
  const citiesForSelectedGovernorate = getCitiesForGovernorate(formData.state);

  // Handle empty cart redirect
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !orderCompleted) {
      router.push("/panier");
    }
  }, [cartLoading, items.length, router, orderCompleted]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const installQuery = router.query.install;
    if (installQuery === "yes") {
      setWantsInstallation(true);
    } else if (installQuery === "no") {
      setWantsInstallation(false);
    }
  }, [router.isReady, router.query.install]);

  const availableProductIds = new Set(
    (Array.isArray(productsData) ? productsData : [])
      .filter((product) => product.isAvailable)
      .map((product) => product._id)
  );
  const unavailableItems = items.filter((item) => !availableProductIds.has(item.productId));
  const hasUnavailableItems = unavailableItems.length > 0;

  const checkoutMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error("Failed to place order");
      }

      return response.json();
    },
    onSuccess: (response) => {
      const serverData = response?.data || {};
      const resolvedTotalAmount =
        typeof serverData.totalAmount === "number"
          ? serverData.totalAmount
          : getTotalPrice() + currentDeliveryFee + (wantsInstallation ? installationFeeData?.fee || 11 : 0);
      const resolvedDeliveryFee =
        typeof serverData.deliveryFee === "number" ? serverData.deliveryFee : currentDeliveryFee;
      const resolvedInstallationFee =
        typeof serverData.installationFee === "number"
          ? serverData.installationFee
          : wantsInstallation
            ? installationFeeData?.fee || 11
            : 0;

      const orderDetails = {
        orderId: serverData.orderId || "",
        totalAmount: resolvedTotalAmount,
        deliveryFee: resolvedDeliveryFee,
        installationFee: resolvedInstallationFee,
        wantsInstallation,
        itemCount: items.length,
        customerName: `${formData.firstName} ${formData.lastName}`.trim(),
        customerPhone: formData.phone,
        customerEmail: formData.email || "Non renseigné",
        address: `${formData.address}, ${formData.city}, ${formData.state} ${formData.postalCode}`,
      };
      sessionStorage.setItem("last-order-details", JSON.stringify(orderDetails));
      setOrderCompleted(true);
      clearCart();
      router.push("/commande-reussie");
    },
    onError: (error) => {
      console.error("Checkout error:", error);
      showError("Erreur lors de la commande. Veuillez réessayer.");
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue =
      name === "phone" ? normalizePhoneValue(value) : name === "email" ? value : value;
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (name === "email" && emailError) {
      setEmailError(getEmailValidationError(nextValue));
    }
    if (name === "phone" && phoneError) {
      setPhoneError(getPhoneValidationError(nextValue, { required: true }));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "state" ? resolveGovernorateName(value) : value,
      ...(name === "state" ? { city: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeEmailValue(formData.email);
    const normalizedPhone = normalizePhoneValue(formData.phone);
    const nextEmailError = getEmailValidationError(normalizedEmail);
    const nextPhoneError = getPhoneValidationError(normalizedPhone, { required: true });
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    setFormData((prev) => ({ ...prev, email: normalizedEmail, phone: normalizedPhone }));
    if (nextEmailError || nextPhoneError) {
      return;
    }

    if (hasUnavailableItems) {
      showError(`Un des produits de votre panier est en ${OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}.`);
      return;
    }

    const orderData = {
      items: items.map((item) => ({
        curtainTypeId: item.productId,
        curtainTypeName: `${item.productName} (${item.curtainType === "panneau" ? "Panneau" : "Store"})`,
        width: item.width,
        height: item.height,
        totalCost: item.calculation.total * item.quantity,
      })),
      customerInfo: {
        ...formData,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
      totalAmount:
        getTotalPrice() +
        currentDeliveryFee +
        (wantsInstallation ? installationFeeData?.fee || 11 : 0),
      deliveryFee: currentDeliveryFee,
      installationFee: wantsInstallation ? installationFeeData?.fee || 11 : 0,
      wantsInstallation,
    };

    checkoutMutation.mutate(orderData);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "TND",
    }).format(price);
  };

  if (cartLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!cartLoading && items.length === 0) {
    return null; // Will redirect to cart
  }

  return (
    <>
      <Head>
        <title>Commande - Rideaux Bambou</title>
        <meta name="description" content="Finalisez votre commande de rideaux en bambou" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="py-6 sm:px-0">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                Finaliser la commande
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Remplissez vos informations pour finaliser votre commande
              </p>
            </motion.div>

            {hasUnavailableItems && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                Certains articles sont en {OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}. Retournez au panier pour les retirer avant de valider la commande.
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
              {/* Order Summary */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800 lg:sticky lg:top-6"
                >
                  <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                    Résumé de la commande
                  </h2>

                  <div className="mb-6 space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col gap-2 text-sm sm:flex-row sm:justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {item.width}cm × {item.height}cm
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {item.curtainType === "panneau" ? "Panneau" : "Store"} - Qté:{" "}
                            {item.quantity}
                          </p>
                          {!availableProductIds.has(item.productId) && (
                            <p className="text-red-600 dark:text-red-400">{OUT_OF_STOCK_CLIENT_MESSAGE}</p>
                          )}
                        </div>
                        <span className="text-gray-900 dark:text-white">
                          {formatPrice(item.calculation.total * item.quantity)}
                        </span>
                      </div>
                    ))}

                    {currentDeliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Frais de livraison</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatPrice(currentDeliveryFee)}
                        </span>
                      </div>
                    )}
                    {wantsInstallation && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Frais de pose
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
                              currentDeliveryFee +
                              (wantsInstallation ? installationFeeData?.fee || 11 : 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Checkout Form */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800"
                >
                  <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                    Informations de livraison
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="firstName"
                          className={formFieldLabelClass}
                        >
                          Prénom *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className={formSelectClass}
                          style={{
                            color: "rgb(17, 24, 39)",
                            WebkitTextFillColor: "rgb(17, 24, 39)",
                            opacity: 1,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lastName"
                          className={formFieldLabelClass}
                        >
                          Nom *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className={formSelectClass}
                          style={{
                            color: "rgb(17, 24, 39)",
                            WebkitTextFillColor: "rgb(17, 24, 39)",
                            opacity: 1,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className={formFieldLabelClass}
                      >
                        Email (optionnel)
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={() => {
                          const normalizedEmail = normalizeEmailValue(formData.email);
                          setFormData((prev) => ({ ...prev, email: normalizedEmail }));
                          setEmailError(getEmailValidationError(normalizedEmail));
                        }}
                        className={formFieldClass}
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                      {emailError && (
                        <p className="mt-1 text-sm text-red-500 dark:text-red-400">{emailError}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className={formFieldLabelClass}
                      >
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        onBlur={() =>
                          setPhoneError(getPhoneValidationError(formData.phone, { required: true }))
                        }
                        inputMode="numeric"
                        maxLength={8}
                        pattern="[0-9]*"
                        required
                        className={formFieldClass}
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                      {phoneError && (
                        <p className="mt-1 text-sm text-red-500 dark:text-red-400">{phoneError}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="address"
                        className={formFieldLabelClass}
                      >
                        Adresse *
                      </label>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        required
                        className={formFieldClass}
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="state"
                          className={formFieldLabelClass}
                        >
                          Gouvernorat *
                        </label>
                        <select
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleSelectChange}
                          required
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
                        <label
                          htmlFor="city"
                          className={formFieldLabelClass}
                        >
                          Ville *
                        </label>
                        <select
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleSelectChange}
                          required
                          disabled={!formData.state}
                          className={formSelectDisabledClass}
                        >
                          <option value="">
                            {formData.state
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

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="postalCode"
                          className={formFieldLabelClass}
                        >
                          Code postal *
                        </label>
                        <input
                          type="text"
                          id="postalCode"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          required
                          className={formSelectClass}
                          style={{
                            color: "rgb(17, 24, 39)",
                            WebkitTextFillColor: "rgb(17, 24, 39)",
                            opacity: 1,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="notes"
                        className={formFieldLabelClass}
                      >
                        Notes (optionnel)
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className={formFieldClass}
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        checkoutMutation.isPending ||
                        Boolean(emailError) ||
                        Boolean(phoneError) ||
                        hasUnavailableItems
                      }
                      className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 font-medium text-white transition-all hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Passer votre commande
                    </button>
                  </form>
                </motion.div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
