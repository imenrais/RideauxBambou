import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import AdminNavigation from "../components/AdminNavigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Loading from "../components/ui/Loading";
import { useToast } from "../contexts/ToastContext";
import { requireAdminPage } from "../lib/admin-page-guard";

const DashboardCharts = dynamic(() => import("../components/admin/DashboardCharts"), {
  loading: () => <div className="p-4 text-center">Chargement des graphiques...</div>,
});

interface AdminDashboardProps {
  title: string;
}

export default function AdminDashboard({ title }: AdminDashboardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newPrice, setNewPrice] = useState("");
  const [newInstallationFee, setNewInstallationFee] = useState("");
  const { success, error, warning } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/login");
    }
  }, [session, status, router]);

  // Fetch current price
  const { data: priceData, isLoading: priceLoading } = useQuery({
    queryKey: ["admin-price"],
    queryFn: async () => {
      const response = await fetch("/api/admin/price");
      const data = await response.json();
      return data.data;
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async (price: number) => {
      const response = await fetch("/api/admin/price", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pricePerM2: price }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-price"] });
      setNewPrice("");
      success("Prix mis à jour avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  // Fetch current installation fee
  const { data: installationFeeData, isLoading: installationFeeLoading } = useQuery({
    queryKey: ["admin-installation-fee"],
    queryFn: async () => {
      const response = await fetch("/api/admin/installation-fee");
      const data = await response.json();
      return data.data;
    },
  });

  // Update installation fee mutation
  const updateInstallationFeeMutation = useMutation({
    mutationFn: async (fee: number) => {
      const response = await fetch("/api/admin/installation-fee", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fee }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-installation-fee"] });
      setNewInstallationFee("");
      success("Frais d'installation mis à jour avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      warning("Veuillez entrer un prix valide.");
      return;
    }
    updatePriceMutation.mutate(price);
  };

  const handleInstallationFeeUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(newInstallationFee);
    if (isNaN(fee) || fee < 0) {
      warning("Veuillez entrer des frais valides.");
      return;
    }
    updateInstallationFeeMutation.mutate(fee);
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
        <meta name="description" content="Tableau de bord administrateur - Rideaux Bambou" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {/* Unified management section */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-0 shadow-xl dark:from-gray-800 dark:via-gray-800 dark:to-gray-900">
              <div className="border-b border-gray-200 bg-white/70 px-6 py-6 dark:border-gray-700 dark:bg-gray-900/40">
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Bienvenue, {session.user?.firstName} {session.user?.lastName}!
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Gérez votre boutique depuis ce tableau de bord.
                </p>
              </div>

              <div className="p-6">
                <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                  Gestion des Prix et Frais
                </h3>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-green-200/60 bg-gradient-to-br from-green-50 to-emerald-50 p-5 dark:border-green-800/40 dark:from-green-900/20 dark:to-emerald-900/20">
                    <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
                      Gestion des Prix
                    </h4>
                    <div className="mb-4 rounded-lg bg-white/70 p-4 dark:bg-gray-800/60">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Prix Actuel</p>
                      {priceLoading ? (
                        <div className="mt-1 text-sm text-gray-500">Chargement...</div>
                      ) : (
                        <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                          {priceData?.pricePerM2} TND/m²
                        </div>
                      )}
                      {priceData?.lastUpdated && (
                        <div className="mt-1 text-xs text-gray-500">
                          Mis à jour: {new Date(priceData.lastUpdated).toLocaleString("fr-FR")}
                        </div>
                      )}
                    </div>
                    <form onSubmit={handlePriceUpdate} className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="^[0-9]+([.,][0-9]{1,2})?$"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value.replace(",", "."))}
                        placeholder="Nouveau prix par m²"
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="submit"
                        loading={updatePriceMutation.isPending}
                        className="whitespace-nowrap px-4 py-2 text-sm"
                      >
                        {updatePriceMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                      </Button>
                    </form>
                  </div>

                  <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-blue-800/40 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
                      Frais d&apos;Installation
                    </h4>
                    <div className="mb-4 rounded-lg bg-white/70 p-4 dark:bg-gray-800/60">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Frais Actuels
                      </p>
                      {installationFeeLoading ? (
                        <div className="mt-1 text-sm text-gray-500">Chargement...</div>
                      ) : (
                        <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {installationFeeData?.fee} TND
                        </div>
                      )}
                      {installationFeeData?.lastUpdated && (
                        <div className="mt-1 text-xs text-gray-500">
                          Mis à jour: {new Date(installationFeeData.lastUpdated).toLocaleString("fr-FR")}
                        </div>
                      )}
                    </div>
                    <form
                      onSubmit={handleInstallationFeeUpdate}
                      className="flex flex-col gap-3 sm:flex-row"
                    >
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="^[0-9]+([.,][0-9]{1,2})?$"
                        value={newInstallationFee}
                        onChange={(e) => setNewInstallationFee(e.target.value.replace(",", "."))}
                        placeholder="Nouveaux frais d'installation"
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="submit"
                        loading={updateInstallationFeeMutation.isPending}
                        className="whitespace-nowrap px-4 py-2 text-sm"
                      >
                        {updateInstallationFeeMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </Card>

            {/* Dashboard Charts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <DashboardCharts />
            </motion.div>
          </motion.div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Tableau de Bord Admin - Rideaux Bambou");
