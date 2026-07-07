import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

import BackButton from "../components/BackButton";
import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { useToast } from "../contexts/ToastContext";

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

const TUNISIAN_GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
];

const GOVERNORATE_CITIES: Record<string, string[]> = {
  Ariana: [
    "Ariana",
    "La Soukra",
    "Raoued",
    "Kalaat el-Andalous",
    "Sidi Thabet",
    "Mnihla",
    "Ettadhamen",
  ],
  "Béja": ["Béja", "Medjez el-Bab", "Testour", "Nefza", "Teboursouk", "Amdoun", "Goubellat", "Thibar"],
  "Ben Arous": [
    "Ben Arous",
    "Mégrine",
    "El Mourouj",
    "Radès",
    "Hammam Lif",
    "Hammam Chott",
    "Ezzahra",
    "Bou Mhel el-Bassatine",
    "Mohamedia",
    "Fouchana",
    "Mornag",
    "Medina Jedida",
  ],
  Bizerte: [
    "Bizerte",
    "Menzel Bourguiba",
    "Mateur",
    "Ras Jebel",
    "Ghar El Melh",
    "El Alia",
    "Menzel Jemil",
    "Menzel Abderrahmane",
    "Sejnane",
    "Joumine",
    "Utique",
    "Ghezala",
    "Tinja",
  ],
  "Gabès": [
    "Gabès",
    "El Hamma",
    "Mareth",
    "Ghannouch",
    "Métouia",
    "Nouvelle Matmata",
    "Matmata",
    "Menzel El Habib",
    "Oudref",
  ],
  Gafsa: [
    "Gafsa",
    "Metlaoui",
    "Redeyef",
    "Moularès",
    "Mdhilla",
    "El Ksar",
    "Sened",
    "El Guettar",
    "Sidi Aïch",
    "Belkhir",
  ],
  Jendouba: [
    "Jendouba",
    "Tabarka",
    "Aïn Draham",
    "Bou Salem",
    "Ghardimaou",
    "Fernana",
    "Balta-Bou Aouane",
    "Oued Mliz",
  ],
  Kairouan: [
    "Kairouan",
    "Sbikha",
    "Bou Hajla",
    "Nasrallah",
    "Haffouz",
    "Oueslatia",
    "Hajeb El Ayoun",
    "Chebika",
    "Chrarda",
    "El Alâa",
    "Menzel Mehiri",
  ],
  Kasserine: [
    "Kasserine",
    "Sbeïtla",
    "Thala",
    "Feriana",
    "Sbiba",
    "Foussana",
    "Haïdra",
    "Jedeliane",
    "El Ayoun",
    "Majel Bel Abbès",
    "Sbeïtba",
  ],
  Kebili: ["Kebili", "Douz", "Souk Lahad", "Faouar", "Jemna", "El Golâa"],
  Kef: [
    "Le Kef",
    "Dahmani",
    "Tajerouine",
    "Jerissa",
    "Sakiet Sidi Youssef",
    "Kalaat Senan",
    "Sers",
    "Al Ksour",
    "Nebeur",
    "Kalaat Khasba",
    "Menzel Salem",
  ],
  Mahdia: [
    "Mahdia",
    "El Jem",
    "Ksour Essef",
    "Chebba",
    "Melloulèche",
    "Bou Merdes",
    "Ouled Chamekh",
    "Sidi Alouane",
    "Rejiche",
    "Hebira",
    "Chorbane",
    "Kerker",
  ],
  Manouba: [
    "Manouba",
    "Oued Ellil",
    "Den Den",
    "Tebourba",
    "Mornaguia",
    "Jedeida",
    "Douar Hicher",
    "Borj El Amri",
  ],
  Medenine: [
    "Medenine",
    "Houmt Souk (Djerba)",
    "Midoun (Djerba)",
    "Ajim (Djerba)",
    "Zarzis",
    "Ben Guerdane",
    "Sidi Makhlouf",
    "Beni Khedache",
  ],
  Monastir: [
    "Monastir",
    "Moknine",
    "Ksar Hellal",
    "Jemmal",
    "Sahline",
    "Teboulba",
    "Bekalta",
    "Sayada",
    "Ouerdanine",
    "Ksibet el-Médiouni",
    "Khniss",
    "Bembla",
    "Zaouiet Kontoch",
    "Touza",
  ],
  Nabeul: [
    "Nabeul",
    "Hammamet",
    "Kélibia",
    "Korba",
    "Menzel Temime",
    "Grombalia",
    "Soliman",
    "Dar Chaâbane El Fehri",
    "El Haouaria",
    "Beni Khiar",
    "Takilsa",
    "Menzel Bouzelfa",
    "Beni Khalled",
    "Azmour",
  ],
  Sfax: [
    "Sfax",
    "Sakiet Ezzit",
    "Sakiet ed-Daïer",
    "Thyna",
    "El Aïn",
    "Gremda",
    "Chihia",
    "Jbeniana",
    "Kerkennah",
    "Mahres",
    "Agareb",
    "Bir Ali Ben Khalifa",
    "Skhira",
    "El Hencha",
    "Graïba",
  ],
  "Sidi Bouzid": [
    "Sidi Bouzid",
    "Regueb",
    "Meknassy",
    "Jilma",
    "Bir El Hafey",
    "Menzel Bouzaiane",
    "Ouled Haffouz",
    "Souk Jedid",
    "Mezzouna",
    "Cebbalat Awled Asker",
  ],
  Siliana: [
    "Siliana",
    "Makthar",
    "Bou Arada",
    "Gaâfour",
    "El Krib",
    "Bargou",
    "Kesra",
    "Rohia",
    "El Aroussa",
    "Sidi Bou Rouis",
  ],
  Sousse: [
    "Sousse",
    "Hammam Sousse",
    "M'saken",
    "Kalâa Kebira",
    "Kalâa Sghira",
    "Akouda",
    "Port El Kantaoui",
    "Enfidha",
    "Bouficha",
    "Hergla",
    "Sidi Bou Ali",
    "Kondar",
    "Messadine",
  ],
  Tataouine: ["Tataouine", "Ghomrassen", "Remada", "Smâr", "Bir Lahmar", "Dehiba"],
  Tozeur: ["Tozeur", "Nefta", "Degache", "Tamerza", "Hazoua", "Hamma du Jérid"],
  Tunis: [
    "Tunis",
    "La Marsa",
    "Carthage",
    "Sidi Bou Said",
    "Le Bardo",
    "La Goulette",
    "El Kram",
    "Gammarth",
    "Sidi Hassine",
  ],
  Zaghouan: ["Zaghouan", "El Fahs", "Bir Mcherga", "Nadhour", "Zriba", "Saouaf"],
};

const normalizeGovernorate = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const GOVERNORATE_CODE_MAP: Record<string, string> = {
  ariana: "AR",
  beja: "BJ",
  "ben arous": "BA",
  bizerte: "BI",
  gabes: "GB",
  gafsa: "GF",
  jendouba: "JE",
  kairouan: "KR",
  kasserine: "KS",
  kebili: "KB",
  kef: "KF",
  mahdia: "MH",
  manouba: "MN",
  medenine: "ME",
  monastir: "MO",
  nabeul: "NB",
  sfax: "SF",
  "sidi bouzid": "SB",
  siliana: "SL",
  sousse: "SO",
  tataouine: "TT",
  tozeur: "TO",
  tunis: "TU",
  zaghouan: "ZA",
};

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
  const citiesForSelectedGovernorate = GOVERNORATE_CITIES[formData.state] || [];

  // Handle empty cart redirect
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !orderCompleted) {
      router.push("/simple-cart");
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
      router.push("/order-success");
    },
    onError: (error) => {
      console.error("Checkout error:", error);
      showError("Erreur lors de la commande. Veuillez réessayer.");
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "state" ? { city: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const orderData = {
      items: items.map((item) => ({
        curtainTypeId: item.productId,
        curtainTypeName: `${item.productName} (${item.curtainType === "panneau" ? "Panneau" : "Store"})`,
        width: item.width,
        height: item.height,
        totalCost: item.calculation.total * item.quantity,
      })),
      customerInfo: formData,
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
            <div className="mb-6">
              <BackButton href="/simple-cart" />
            </div>
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
                        </div>
                        <span className="text-gray-900 dark:text-white">
                          {formatPrice(item.calculation.total * item.quantity)}
                        </span>
                      </div>
                    ))}

                    {/* Installation Option */}
                    <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="checkout-installation-option"
                            checked={wantsInstallation}
                            onChange={(e) => setWantsInstallation(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <label
                            htmlFor="checkout-installation-option"
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
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Email (optionnel)
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="address"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Gouvernorat *
                        </label>
                        <select
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleSelectChange}
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Notes (optionnel)
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        style={{
                          color: "rgb(17, 24, 39)",
                          WebkitTextFillColor: "rgb(17, 24, 39)",
                          opacity: 1,
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={checkoutMutation.isPending}
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
