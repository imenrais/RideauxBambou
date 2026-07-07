import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";

import AdminNavigation from "../../components/AdminNavigation";
import BackButton from "../../components/BackButton";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/Table";
import { requireAdminPage } from "../../lib/admin-page-guard";

interface AdminDeliveryFeesProps {
  title: string;
}

interface DeliveryFee {
  _id: string;
  state: string;
  stateCode: string;
  fee: number;
  isActive: boolean;
  lastUpdated: string;
  updatedBy: string;
}

const GOVERNORATES: Array<{ label: string; code: string }> = [
  { label: "Ariana", code: "AR" },
  { label: "Béja", code: "BJ" },
  { label: "Ben Arous", code: "BA" },
  { label: "Bizerte", code: "BI" },
  { label: "Gabès", code: "GB" },
  { label: "Gafsa", code: "GF" },
  { label: "Jendouba", code: "JE" },
  { label: "Kairouan", code: "KR" },
  { label: "Kasserine", code: "KS" },
  { label: "Kebili", code: "KB" },
  { label: "Kef", code: "KF" },
  { label: "Mahdia", code: "MH" },
  { label: "Manouba", code: "MN" },
  { label: "Medenine", code: "ME" },
  { label: "Monastir", code: "MO" },
  { label: "Nabeul", code: "NB" },
  { label: "Sfax", code: "SF" },
  { label: "Sidi Bouzid", code: "SB" },
  { label: "Siliana", code: "SL" },
  { label: "Sousse", code: "SO" },
  { label: "Tataouine", code: "TT" },
  { label: "Tozeur", code: "TO" },
  { label: "Tunis", code: "TU" },
  { label: "Zaghouan", code: "ZA" },
];

const normalizeGovernorate = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function AdminDeliveryFees({ title }: AdminDeliveryFeesProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/login");
    }
  }, [session, status, router]);

  // Fetch delivery fees
  const { data: deliveryFees, isLoading } = useQuery<DeliveryFee[]>({
    queryKey: ["admin-delivery-fees"],
    queryFn: async () => {
      const response = await fetch("/api/admin/delivery-fees");
      const data = await response.json();
      return data.data || [];
    },
  });

  const feesByGovernorate = useMemo(() => {
    return GOVERNORATES.map((governorate) => {
      const matchedFee = deliveryFees?.find((fee) => {
        return (
          fee.stateCode === governorate.code ||
          normalizeGovernorate(fee.state) === normalizeGovernorate(governorate.label)
        );
      });
      return {
        state: governorate.label,
        stateCode: governorate.code,
        fee: matchedFee?.fee ?? 0,
        lastUpdated: matchedFee?.lastUpdated ?? "",
      };
    });
  }, [deliveryFees]);

  // Save all edited delivery fees with one button
  const updateFeeMutation = useMutation({
    mutationFn: async (updates: Array<{ state: string; fee: number }>) => {
      for (const update of updates) {
        const response = await fetch("/api/admin/delivery-fees", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(update),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Erreur de sauvegarde");
        }
      }
    },
    onSuccess: (_, updates) => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-fees"] });
      setSaveFeedback({
        type: "success",
        message: `${updates.length} gouvernorat(s) enregistré(s) avec succès.`,
      });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      setSaveFeedback({ type: "error", message: `Erreur: ${message}` });
    },
  });

  useEffect(() => {
    if (!feesByGovernorate.length) return;
    const nextDrafts: Record<string, string> = {};
    for (const fee of feesByGovernorate) {
      nextDrafts[fee.state] = fee.fee.toFixed(2);
    }
    setFeeDrafts(nextDrafts);
  }, [feesByGovernorate]);

  const handleFeeChange = (state: string, value: string) => {
    setFeeDrafts((prev) => ({ ...prev, [state]: value.replace(",", ".") }));
    if (saveFeedback) {
      setSaveFeedback(null);
    }
  };

  const handleSaveAll = () => {
    if (updateFeeMutation.isPending) {
      return;
    }

    const updates: Array<{ state: string; fee: number }> = [];
    const correctedDrafts = { ...feeDrafts };

    for (const feeRow of feesByGovernorate) {
      const rawValue = correctedDrafts[feeRow.state] ?? feeRow.fee.toString();
      const parsedFee = parseFloat(rawValue);

      if (isNaN(parsedFee) || parsedFee < 0) {
        setSaveFeedback({
          type: "error",
          message: `Valeur invalide pour ${feeRow.state}. Entrez un nombre >= 0.`,
        });
        correctedDrafts[feeRow.state] = feeRow.fee.toFixed(2);
        setFeeDrafts(correctedDrafts);
        return;
      }

      if (Math.abs(parsedFee - feeRow.fee) >= 0.001) {
        updates.push({ state: feeRow.stateCode, fee: parsedFee });
      }
    }

    if (!updates.length) {
      setSaveFeedback({ type: "info", message: "Aucun changement à enregistrer." });
      return;
    }

    updateFeeMutation.mutate(updates);
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
        <meta
          name="description"
          content="Gestion des frais de livraison par gouvernorat - Rideaux Bambou Admin"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
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
            <Card>
              <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                Gestion des Frais de Livraison
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Configurez les frais de livraison pour chaque gouvernorat de Tunisie
              </p>
            </Card>

            {/* Delivery Fees Table */}
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Frais par Gouvernorat
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loading text="Chargement des frais de livraison..." />
                </div>
              ) : (
                <div className="mx-auto w-full max-w-5xl overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gouvernorat</TableHead>
                      <TableHead>Frais (TND)</TableHead>
                      <TableHead>Dernière Mise à Jour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feesByGovernorate.map((fee) => (
                      <TableRow key={fee.state} hover>
                        <TableCell>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {fee.state}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              pattern="^[0-9]+([.,][0-9]{1,2})?$"
                              value={feeDrafts[fee.state] ?? fee.fee.toFixed(2)}
                              onChange={(e) => handleFeeChange(fee.state, e.target.value)}
                              className="w-20 text-center"
                            />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              TND
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {fee.lastUpdated
                              ? new Date(fee.lastUpdated).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  <div className="mt-4 space-y-3">
                    {saveFeedback && (
                      <p
                        className={`text-sm ${
                          saveFeedback.type === "success"
                            ? "text-green-600 dark:text-green-400"
                            : saveFeedback.type === "error"
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {saveFeedback.message}
                      </p>
                    )}
                    <div className="flex w-full justify-end">
                      <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={updateFeeMutation.isPending}
                        className="inline-flex min-w-[140px] items-center justify-center rounded-lg bg-green-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updateFeeMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Frais de Livraison - Rideaux Bambou Admin");
