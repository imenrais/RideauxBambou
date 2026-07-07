import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import AdminNavigation from "../../components/AdminNavigation";
import BackButton from "../../components/BackButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";

interface AdminOrdersProps {
  title: string;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusOptions = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En cours" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En cours",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function AdminOrders({ title }: AdminOrdersProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [manualOrderError, setManualOrderError] = useState("");
  const [manualOrderForm, setManualOrderForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    curtainTypeName: "",
    width: "",
    height: "",
    itemTotalCost: "",
    deliveryFee: "0",
    installationFee: "0",
    wantsInstallation: false,
    status: "pending",
    notes: "",
  });
  const { success, error } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/login");
    }
  }, [session, status, router]);

  // Fetch orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["admin-orders", selectedStatus, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(selectedStatus && { status: selectedStatus }),
      });

      const response = await fetch(`/api/admin/orders?${params}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await fetch(`/api/admin/orders?id=${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      success("Statut de commande mis à jour.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleInlineStatusUpdate = (orderId: string, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  const createOrderMutation = useMutation({
    mutationFn: async (payload: {
      customerInfo: {
        firstName: string;
        lastName: string;
        email?: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
      };
      item: {
        curtainTypeName: string;
        width: number;
        height: number;
        totalCost: number;
      };
      wantsInstallation: boolean;
      deliveryFee: number;
      installationFee: number;
      status: string;
      notes?: string;
    }) => {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setManualOrderForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        curtainTypeName: "",
        width: "",
        height: "",
        itemTotalCost: "",
        deliveryFee: "0",
        installationFee: "0",
        wantsInstallation: false,
        status: "pending",
        notes: "",
      });
      setManualOrderError("");
      success("Commande créée avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      setManualOrderError(message);
      error(`Erreur: ${message}`);
    },
  });

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderError("");

    const width = Number(manualOrderForm.width);
    const height = Number(manualOrderForm.height);
    const itemTotalCost = Number(manualOrderForm.itemTotalCost);
    const deliveryFee = Number(manualOrderForm.deliveryFee);
    const installationFee = Number(manualOrderForm.installationFee);

    if ([width, height, itemTotalCost, deliveryFee, installationFee].some((n) => Number.isNaN(n))) {
      setManualOrderError("Veuillez saisir des valeurs numériques valides.");
      return;
    }

    createOrderMutation.mutate({
      customerInfo: {
        firstName: manualOrderForm.firstName.trim(),
        lastName: manualOrderForm.lastName.trim(),
        email: manualOrderForm.email.trim(),
        phone: manualOrderForm.phone.trim(),
        address: manualOrderForm.address.trim(),
        city: manualOrderForm.city.trim(),
        state: manualOrderForm.state.trim(),
        postalCode: manualOrderForm.postalCode.trim(),
      },
      item: {
        curtainTypeName: manualOrderForm.curtainTypeName.trim(),
        width,
        height,
        totalCost: itemTotalCost,
      },
      wantsInstallation: manualOrderForm.wantsInstallation,
      deliveryFee,
      installationFee,
      status: manualOrderForm.status,
      notes: manualOrderForm.notes.trim(),
    });
  };

  const printInvoice = (order: any) => {
    const invoiceWindow = window.open("", "_blank", "width=900,height=700");
    if (!invoiceWindow) {
      error("Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }

    const customer = order.customerInfo || {};
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const itemsRows = orderItems
      .map(
        (item: any) => `
          <tr>
            <td>${item.curtainTypeName || "Produit"}</td>
            <td>${item.width || 0}cm x ${item.height || 0}cm</td>
            <td>${(item.totalCost || 0).toFixed(2)} TND</td>
          </tr>
        `
      )
      .join("");

    invoiceWindow.document.write(`
      <html>
        <head>
          <title>Facture #${order._id?.slice(-8)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin-bottom: 8px; }
            .muted { color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
            .totals { margin-top: 16px; width: 320px; margin-left: auto; }
            .totals p { display: flex; justify-content: space-between; margin: 6px 0; }
            .grand { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Facture</h1>
          <p class="muted">Commande #${order._id?.slice(-8)} - ${new Date(order.createdAt).toLocaleString("fr-FR")}</p>
          <p><strong>Client:</strong> ${getCustomerFullName(customer)}</p>
          <p><strong>Téléphone:</strong> ${customer.phone || "-"}</p>
          <p><strong>Adresse:</strong> ${customer.address || "-"}, ${customer.city || "-"}, ${customer.state || "-"}</p>

          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Dimensions</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>${itemsRows || "<tr><td colspan='3'>Aucun article</td></tr>"}</tbody>
          </table>

          <div class="totals">
            <p><span>Sous-total</span><span>${(
              (order.totalAmount || 0) - (order.deliveryFee || 0) - (order.installationFee || 0)
            ).toFixed(2)} TND</span></p>
            <p><span>Livraison</span><span>${(order.deliveryFee || 0).toFixed(2)} TND</span></p>
            <p><span>Installation</span><span>${(order.installationFee || 0).toFixed(2)} TND</span></p>
            <p class="grand"><span>Total</span><span>${(order.totalAmount || 0).toFixed(2)} TND</span></p>
          </div>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
    invoiceWindow.focus();
    invoiceWindow.print();
  };

  const getCustomerFullName = (customerInfo: any) => {
    const firstName = customerInfo?.firstName?.trim() || "";
    const lastName = customerInfo?.lastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || customerInfo?.name || "Client";
  };

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Manage Orders - Rideaux Bambou Admin" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <BackButton href="/admin" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Gérer les Commandes
              </h2>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 sm:w-auto dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="" className="text-gray-900 dark:text-white">
                  Tous les statuts
                </option>
                {statusOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="text-gray-900 dark:text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Stats Cards */}
            {ordersData?.stats && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="col-span-2 rounded-lg bg-white p-4 text-center shadow-sm md:col-span-3 lg:col-span-5 dark:bg-gray-800"
                >
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Total Commandes
                  </h3>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {ordersData.stats.totalOrders}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    ⏳
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    En Attente
                  </h3>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {ordersData.stats.pendingOrders}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-blue-600 dark:text-blue-400">✅</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Confirmées
                  </h3>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {ordersData.stats.confirmedOrders || 0}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.28 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-purple-600 dark:text-purple-400">🛠️</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    En cours
                  </h3>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {ordersData.stats.processingOrders || 0}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.35 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-green-600 dark:text-green-400">
                    ✓
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Livrées
                  </h3>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {ordersData.stats.deliveredOrders}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="rounded-lg bg-white p-4 text-center shadow-sm dark:bg-gray-800"
                >
                  <div className="mb-1 text-xl font-bold text-red-600 dark:text-red-400">✕</div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Annulées
                  </h3>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {ordersData.stats.cancelledOrders || 0}
                  </p>
                </motion.div>
              </div>
            )}

            <Card className="p-4 sm:p-6">
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                Ajouter une commande
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                L'admin peut créer une commande manuelle depuis cette section.
              </p>
              <form
                onSubmit={handleCreateManualOrder}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                <Input
                  label="Prénom client"
                  value={manualOrderForm.firstName}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  required
                />
                <Input
                  label="Nom client"
                  value={manualOrderForm.lastName}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  required
                />
                <Input
                  type="email"
                  label="Email (optionnel)"
                  value={manualOrderForm.email}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  label="Téléphone"
                  value={manualOrderForm.phone}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, phone: e.target.value }))}
                  required
                />
                <Input
                  label="Adresse"
                  value={manualOrderForm.address}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, address: e.target.value }))}
                  required
                />
                <Input
                  label="Ville"
                  value={manualOrderForm.city}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, city: e.target.value }))}
                  required
                />
                <Input
                  label="Région"
                  value={manualOrderForm.state}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, state: e.target.value }))}
                  required
                />
                <Input
                  label="Code postal"
                  value={manualOrderForm.postalCode}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, postalCode: e.target.value }))
                  }
                  required
                />
                <Input
                  label="Produit"
                  value={manualOrderForm.curtainTypeName}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, curtainTypeName: e.target.value }))
                  }
                  required
                />
                <Input
                  type="number"
                  label="Largeur (cm)"
                  value={manualOrderForm.width}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, width: e.target.value }))}
                  min="1"
                  step="1"
                  required
                />
                <Input
                  type="number"
                  label="Hauteur (cm)"
                  value={manualOrderForm.height}
                  onChange={(e) => setManualOrderForm((prev) => ({ ...prev, height: e.target.value }))}
                  min="1"
                  step="1"
                  required
                />
                <Input
                  type="number"
                  label="Prix produit (TND)"
                  value={manualOrderForm.itemTotalCost}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, itemTotalCost: e.target.value }))
                  }
                  min="0"
                  step="0.01"
                  required
                />
                <Input
                  type="number"
                  label="Frais livraison (TND)"
                  value={manualOrderForm.deliveryFee}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, deliveryFee: e.target.value }))
                  }
                  min="0"
                  step="0.01"
                  required
                />
                <Input
                  type="number"
                  label="Frais pose (TND)"
                  value={manualOrderForm.installationFee}
                  onChange={(e) =>
                    setManualOrderForm((prev) => ({ ...prev, installationFee: e.target.value }))
                  }
                  min="0"
                  step="0.01"
                  required
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Statut initial
                  </label>
                  <select
                    value={manualOrderForm.status}
                    onChange={(e) =>
                      setManualOrderForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="manual_wants_installation"
                    type="checkbox"
                    checked={manualOrderForm.wantsInstallation}
                    onChange={(e) =>
                      setManualOrderForm((prev) => ({
                        ...prev,
                        wantsInstallation: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label
                    htmlFor="manual_wants_installation"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Pose demandée
                  </label>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={manualOrderForm.notes}
                    onChange={(e) => setManualOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                {manualOrderError && (
                  <p className="text-sm font-medium text-red-600 md:col-span-2 lg:col-span-3 dark:text-red-400">
                    {manualOrderError}
                  </p>
                )}
                <div className="flex justify-end md:col-span-2 xl:col-span-3">
                  <Button type="submit" loading={createOrderMutation.isPending} className="w-full sm:w-auto">
                    {createOrderMutation.isPending ? "Création..." : "Créer la commande"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Orders Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Chargement des commandes...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {ordersData?.orders?.map((order: any) => (
                      <div
                        key={`${order._id}-mobile`}
                        className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              #{order._id.slice(-8)}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {getCustomerFullName(order.customerInfo)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              statusColors[(order.status || "pending") as keyof typeof statusColors] ||
                              "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {statusLabels[order.status] || order.status}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <p>Total: {order.totalAmount?.toFixed(2) || "0.00"} TND</p>
                          <p>Région: {order.customerInfo?.state || "N/A"}</p>
                          <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={order.status}
                            onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                            disabled={updateStatusMutation.isPending}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => printInvoice(order)}
                          >
                            Imprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-max min-w-full table-auto divide-y divide-gray-200 [&_td]:px-3 [&_th]:px-3 [&_th]:font-semibold [&_th]:tracking-wide sm:[&_td]:px-6 sm:[&_th]:px-6 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          ID Commande
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Client
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Produit
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Dimensions
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Total
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Région
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Installation
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Statut
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Date
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          Facture
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {ordersData?.orders?.map((order: any) => (
                        <tr key={order._id}>
                          <td className="whitespace-nowrap px-6 py-4 text-center font-mono text-sm text-gray-900 dark:text-white">
                            #{order._id.slice(-8)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <div className="text-center">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {getCustomerFullName(order.customerInfo)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-product-${index}`}>
                                  {item.curtainTypeName || "N/A"}
                                </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            <div className="space-y-1">
                              {(order.items || []).map((item: any, index: number) => (
                                <div key={`${order._id}-dimension-${index}`}>
                                  {item.width}cm × {item.height}cm
                                </div>
                              ))}
                              {(!order.items || order.items.length === 0) && <div>N/A</div>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm font-medium text-gray-900 dark:text-white">
                            {order.totalAmount?.toFixed(2) || "0.00"} TND
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            {order.customerInfo.state || "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                order.wantsInstallation
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {order.wantsInstallation ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <select
                              value={order.status}
                              onChange={(e) => handleInlineStatusUpdate(order._id, e.target.value)}
                              disabled={updateStatusMutation.isPending}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <Button type="button" size="sm" variant="secondary" onClick={() => printInvoice(order)}>
                              Imprimer
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Pagination */}
              {ordersData?.pagination && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(
                          Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                        )
                      }
                      disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Suivant
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Page <span className="font-medium">{currentPage}</span> sur{" "}
                        <span className="font-medium">
                          {ordersData?.pagination?.totalPages || 1}
                        </span>{" "}
                        ({ordersData?.pagination?.totalOrders || 0} commandes au total)
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                        >
                          Précédent
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPage(
                              Math.min(ordersData?.pagination?.totalPages || 1, currentPage + 1)
                            )
                          }
                          disabled={currentPage === (ordersData?.pagination?.totalPages || 1)}
                          className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                        >
                          Suivant
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </main>

      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Gérer les Commandes - Rideaux Bambou Admin");
