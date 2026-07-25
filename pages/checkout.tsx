import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { useToast } from "../contexts/ToastContext";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
} from "../lib/customer-info";
import { formatCurtainTypeName } from "../lib/curtain-type-name";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";
import {
  calculateOrderInvoiceTotals,
  getOrderSummaryLines,
} from "../lib/invoice-totals";
import {
  applyMatriculeFiscaleInput,
  formatMatriculeFiscale,
  getMatriculeFiscaleValidationError,
  MATRICULE_FISCALE_FORMAT,
} from "../lib/matricule-fiscale";
import { getPhoneValidationError, normalizePhoneValue } from "../lib/phone-validation";
import { usePublicProductsQuery } from "../lib/products-query";
import { OUT_OF_STOCK_CLIENT_MESSAGE } from "../lib/product-availability-sync";
import { getCurtainLineTotal } from "../lib/order-pricing";
import { parseDeliveryFeesResponse } from "../lib/delivery-fees-query";
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
  customerType: CustomerType;
  firstName: string;
  lastName: string;
  companyName: string;
  matriculeFiscale: string;
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
    getTotalItems,
    clearCart,
  } = useSimpleCart();
  const [wantsInstallation, setWantsInstallation] = useState<boolean | null>(null);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [matriculeFiscaleError, setMatriculeFiscaleError] = useState("");
  const { error: showError } = useToast();
  const [formData, setFormData] = useState<CheckoutFormData>({
    customerType: "person",
    firstName: "",
    lastName: "",
    companyName: "",
    matriculeFiscale: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  });
  const isCompanyOrder = formData.customerType === "company";

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
  const { data: deliveryFeesPayload } = useQuery({
    queryKey: ["delivery-fees"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/delivery-fees");
        const data = await response.json();
        return data.success ? parseDeliveryFeesResponse(data.data) : parseDeliveryFeesResponse([]);
      } catch (error) {
        console.error("Error fetching delivery fees:", error);
        return parseDeliveryFeesResponse([]);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const deliveryFees = deliveryFeesPayload?.fees ?? [];
  const isFreeDeliveryActive = deliveryFeesPayload?.isFreeDeliveryActive === true;

  // Get current delivery fee based on selected state
  const normalizedSelectedState = normalizeGovernorate(formData.state);
  const selectedStateCode =
    GOVERNORATE_CODE_MAP[normalizedSelectedState] ||
    (formData.state.trim().length === 2 ? formData.state.trim().toUpperCase() : "");
  const hasSelectedRegion = formData.state.trim().length > 0;
  const currentDeliveryFee = hasSelectedRegion
    ? deliveryFees.find(
        (fee: any) =>
          normalizeGovernorate(fee.state) === normalizedSelectedState ||
          fee.stateCode === selectedStateCode
      )?.fee ?? 0
    : 0;
  const citiesForSelectedGovernorate = getCitiesForGovernorate(formData.state);
  const installationFee = wantsInstallation === true ? installationFeeData?.fee || 11 : 0;
  const baseOrderTotal = getTotalPrice() + currentDeliveryFee + installationFee;
  const invoiceTotals = useMemo(
    () =>
      calculateOrderInvoiceTotals({
        totalAmount: baseOrderTotal,
        deliveryFee: currentDeliveryFee,
        installationFee: installationFee,
        customerInfo: { customerType: formData.customerType },
      }),
    [baseOrderTotal, currentDeliveryFee, installationFee, formData.customerType]
  );
  const invoiceSummaryLines = useMemo(
    () =>
      getOrderSummaryLines(invoiceTotals, {
        regionSelected: hasSelectedRegion,
        isFreeDeliveryActive,
      }),
    [invoiceTotals, hasSelectedRegion, isFreeDeliveryActive]
  );

  // Handle empty cart redirect
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !orderCompleted) {
      router.push("/panier");
    }
  }, [cartLoading, items.length, router, orderCompleted]);

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
          : baseOrderTotal;
      const resolvedDeliveryFee =
        typeof serverData.deliveryFee === "number" ? serverData.deliveryFee : currentDeliveryFee;
      const resolvedInstallationFee =
        typeof serverData.installationFee === "number"
          ? serverData.installationFee
          : installationFee;

      const orderDetails = {
        orderId: serverData.orderId || "",
        totalAmount: resolvedTotalAmount,
        deliveryFee: resolvedDeliveryFee,
        installationFee: resolvedInstallationFee,
        itemCount:
          typeof serverData.itemCount === "number" ? serverData.itemCount : getTotalItems(),
        customerType: formData.customerType,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        customerPhone: formData.phone,
        customerEmail: normalizeEmailValue(formData.email),
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

  const handleCustomerTypeChange = (customerType: CustomerType) => {
    setFormData((prev) => ({
      ...prev,
      customerType,
      ...(customerType === "person"
        ? { companyName: "", matriculeFiscale: "" }
        : { firstName: "", lastName: "" }),
    }));
    if (customerType === "person") {
      setMatriculeFiscaleError("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue =
      name === "phone"
        ? normalizePhoneValue(value)
        : name === "email"
          ? value
          : name === "matriculeFiscale"
            ? applyMatriculeFiscaleInput(formData.matriculeFiscale, value)
            : value;
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
    if (name === "matriculeFiscale" && matriculeFiscaleError) {
      setMatriculeFiscaleError(getMatriculeFiscaleValidationError(nextValue));
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
    const formattedMatriculeFiscale = formatMatriculeFiscale(formData.matriculeFiscale);
    const nextEmailError = getEmailValidationError(normalizedEmail);
    const nextPhoneError = getPhoneValidationError(normalizedPhone, { required: true });
    const nextMatriculeFiscaleError = isCompanyOrder
      ? getMatriculeFiscaleValidationError(formattedMatriculeFiscale)
      : "";
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    setMatriculeFiscaleError(nextMatriculeFiscaleError);
    setFormData((prev) => ({
      ...prev,
      email: normalizedEmail,
      phone: normalizedPhone,
      matriculeFiscale: formattedMatriculeFiscale,
    }));
    if (nextEmailError || nextPhoneError || nextMatriculeFiscaleError) {
      return;
    }

    if (hasUnavailableItems) {
      showError(`Un des produits de votre panier est en ${OUT_OF_STOCK_CLIENT_MESSAGE.toLowerCase()}.`);
      return;
    }

    if (wantsInstallation === null) {
      showError("Veuillez indiquer si vous souhaitez la pose.");
      return;
    }

    const orderData = {
      items: items.map((item) => ({
        curtainTypeId: item.productId,
        curtainTypeName: formatCurtainTypeName(item.productName, item.curtainType),
        curtainType: item.curtainType,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        totalCost: getCurtainLineTotal(
          item.curtainType,
          item.calculation.total,
          item.quantity
        ),
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navigation />
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
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
        <link rel="icon" href="/images/logo.png" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
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
              <h1 className="mb-2 text-2xl font-bold sm:text-3xl text-gray-900 dark:text-white">
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

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
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
                          {formatPrice(
                            getCurtainLineTotal(
                              item.curtainType,
                              item.calculation.total,
                              item.quantity
                            )
                          )}
                        </span>
                      </div>
                    ))}

                    <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                      <label className={formFieldLabelClass}>Pose *</label>
                      <div className="flex flex-wrap gap-4">
                        {([true, false] as const).map((wantsPose) => (
                          <label
                            key={wantsPose ? "oui" : "non"}
                            className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                          >
                            <input
                              type="radio"
                              name="pose"
                              checked={wantsInstallation === wantsPose}
                              onChange={() => setWantsInstallation(wantsPose)}
                              className="sr-only"
                            />
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                              <span
                                className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                  wantsInstallation === wantsPose ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </span>
                            <span className="text-sm">{wantsPose ? "Oui" : "Non"}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                      <div className="space-y-2 text-sm">
                        {invoiceSummaryLines.map((line) => (
                          <div
                            key={line.label}
                            className={`flex justify-between ${
                              line.emphasis
                                ? "border-t border-gray-200 pt-3 text-lg font-semibold dark:border-gray-700"
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            <span
                              className={
                                line.emphasis
                                  ? "text-gray-900 dark:text-white"
                                  : undefined
                              }
                            >
                              {line.label}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {line.displayText ?? formatPrice(line.amount)}
                        </span>
                          </div>
                        ))}
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
                      <div>
                      <label className={formFieldLabelClass}>Type de client *</label>
                      <div className="flex flex-wrap gap-4">
                        {(["person", "company"] as const).map((type) => (
                        <label
                            key={type}
                            className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                          >
                            <input
                              type="radio"
                              name="customerType"
                              value={type}
                              checked={formData.customerType === type}
                              onChange={() => handleCustomerTypeChange(type)}
                              className="sr-only"
                            />
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white">
                              <span
                                className={`h-2 w-2 rounded-full bg-black transition-opacity ${
                                  formData.customerType === type ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </span>
                            <span className="text-sm">{CUSTOMER_TYPE_LABELS[type]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {isCompanyOrder ? (
                      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label htmlFor="companyName" className={formFieldLabelClass}>
                            Nom de l&apos;entreprise *
                          </label>
                          <input
                            type="text"
                            id="companyName"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleInputChange}
                            required
                            className={formSelectClass}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="matriculeFiscale" className={formFieldLabelClass}>
                            Matricule fiscale *
                          </label>
                          <input
                            type="text"
                            id="matriculeFiscale"
                            name="matriculeFiscale"
                            value={formData.matriculeFiscale}
                            onChange={handleInputChange}
                            onBlur={() =>
                              setMatriculeFiscaleError(
                                getMatriculeFiscaleValidationError(formData.matriculeFiscale)
                              )
                            }
                            required
                            placeholder={MATRICULE_FISCALE_FORMAT}
                            maxLength={17}
                            className={formSelectClass}
                          />
                          {matriculeFiscaleError && (
                            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                              {matriculeFiscaleError}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                        <div>
                          <label htmlFor="firstName" className={formFieldLabelClass}>
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
                        />
                      </div>
                      <div>
                          <label htmlFor="lastName" className={formFieldLabelClass}>
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
                        />
                      </div>
                    </div>
                    )}

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
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
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

                    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
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
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        checkoutMutation.isPending ||
                        wantsInstallation === null ||
                        Boolean(emailError) ||
                        Boolean(phoneError) ||
                        Boolean(matriculeFiscaleError) ||
                        hasUnavailableItems
                      }
                      className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
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
