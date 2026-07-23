import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  adminTableComfortableSpacingClassName,
  adminTableShellClassName,
} from "../../components/ui/Table";

interface DeliveryFeesResponse {
  fees: DeliveryFee[];
  isFreeDeliveryActive: boolean;
  restoredFromBackup?: boolean;
}

type FreeDeliveryConfirmModal = "activate" | "deactivate" | null;

interface DeliveryFee {
  _id: string;
  state: string;
  stateCode: string;
  fee: number;
  isActive: boolean;
  lastUpdated: string;
  updatedBy: string;
}

const ADMIN_DELIVERY_FEES_QUERY_KEY = ["admin-delivery-fees"] as const;
const ADMIN_DELIVERY_FEES_STATS_QUERY_KEY = ["admin-delivery-fees-stats"] as const;

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

function buildFeeDraftsFromFees(fees: DeliveryFee[] | undefined): Record<string, string> {
  const nextDrafts: Record<string, string> = {};
  for (const governorate of GOVERNORATES) {
    const matchedFee = fees?.find(
      (fee) =>
        fee.stateCode === governorate.code ||
        normalizeGovernorate(fee.state) === normalizeGovernorate(governorate.label)
    );
    nextDrafts[governorate.label] = (matchedFee?.fee ?? 0).toFixed(2);
  }
  return nextDrafts;
}

function parseDeliveryFeesResponse(data: {
  success?: boolean;
  data?: DeliveryFee[];
  meta?: { isFreeDeliveryActive?: boolean; restoredFromBackup?: boolean };
}): DeliveryFeesResponse {
  return {
    fees: data.data || [],
    isFreeDeliveryActive: Boolean(data.meta?.isFreeDeliveryActive),
    restoredFromBackup: data.meta?.restoredFromBackup,
  };
}

export default function AdminDeliveryFees() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [confirmModal, setConfirmModal] = useState<FreeDeliveryConfirmModal>(null);

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/connexion");
    }
  }, [session, status, router]);

  // Fetch delivery fees
  const { data: deliveryFeesResponse, isLoading } = useQuery<DeliveryFeesResponse>({
    queryKey: ADMIN_DELIVERY_FEES_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/admin/delivery-fees");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible de charger les frais de livraison");
      }
      return parseDeliveryFeesResponse(data);
    },
  });

  const deliveryFees = deliveryFeesResponse?.fees;
  const isFreeDeliveryActive = deliveryFeesResponse?.isFreeDeliveryActive === true;

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

  const makeAllFreeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/delivery-fees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "make-all-free" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'activation de la livraison gratuite");
      }
      return parseDeliveryFeesResponse(data);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DeliveryFeesResponse>(ADMIN_DELIVERY_FEES_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: ADMIN_DELIVERY_FEES_STATS_QUERY_KEY });
      setFeeDrafts(buildFeeDraftsFromFees(result.fees));
      setConfirmModal(null);
    },
    onError: () => {
      setConfirmModal(null);
    },
  });

  const restoreDeliveryFeesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/delivery-fees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "restore-from-backup" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la restauration des tarifs");
      }
      return parseDeliveryFeesResponse(data);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DeliveryFeesResponse>(ADMIN_DELIVERY_FEES_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: ADMIN_DELIVERY_FEES_STATS_QUERY_KEY });
      setFeeDrafts(buildFeeDraftsFromFees(result.fees));
      setConfirmModal(null);
    },
    onError: () => {
      setConfirmModal(null);
    },
  });

  const isFreeDeliveryMutationPending =
    makeAllFreeMutation.isPending || restoreDeliveryFeesMutation.isPending;

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
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erreur de sauvegarde");
        }
      }

      const response = await fetch("/api/admin/delivery-fees");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du rechargement des frais");
      }
      return parseDeliveryFeesResponse(data);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DeliveryFeesResponse>(ADMIN_DELIVERY_FEES_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: ADMIN_DELIVERY_FEES_STATS_QUERY_KEY });
      setFeeDrafts(buildFeeDraftsFromFees(result.fees));
    },
  });

  useEffect(() => {
    if (!deliveryFees || updateFeeMutation.isPending) {
      return;
    }
    setFeeDrafts(buildFeeDraftsFromFees(deliveryFees));
  }, [deliveryFees, updateFeeMutation.isPending]);

  const handleFeeChange = (state: string, value: string) => {
    setFeeDrafts((prev) => ({ ...prev, [state]: value.replace(",", ".") }));
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
        correctedDrafts[feeRow.state] = feeRow.fee.toFixed(2);
        setFeeDrafts(correctedDrafts);
        return;
      }

      if (Math.abs(parsedFee - feeRow.fee) >= 0.001) {
        updates.push({ state: feeRow.stateCode, fee: parsedFee });
      }
    }

    if (!updates.length) {
      return;
    }

    updateFeeMutation.mutate(updates);
  };

  const handleFreeDeliveryToggle = () => {
    if (isFreeDeliveryMutationPending || updateFeeMutation.isPending) {
      return;
    }

    setConfirmModal(isFreeDeliveryActive ? "deactivate" : "activate");
  };

  const closeConfirmModal = () => {
    if (!isFreeDeliveryMutationPending) {
      setConfirmModal(null);
    }
  };

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <AdminLayout
      title="Frais de Livraison - Rideaux Bambou Admin"
      description="Gestion des frais de livraison par gouvernorat - Rideaux Bambou Admin"
    >
      <div className="mb-6">
        <BackButton href="/admin" />
      </div>

      <div className="mb-14 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Frais de Livraison
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configurez les frais de livraison pour chaque gouvernorat de Tunisie
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Livraison gratuite
          </span>
          <span
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
              isFreeDeliveryActive ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
            } ${isFreeDeliveryMutationPending || updateFeeMutation.isPending ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={isFreeDeliveryActive}
              onChange={handleFreeDeliveryToggle}
              disabled={isFreeDeliveryMutationPending || updateFeeMutation.isPending}
              className="sr-only"
            />
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${
                isFreeDeliveryActive ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading text="Chargement des frais de livraison..." />
        </div>
      ) : (
        <>
          <div className={adminTableShellClassName}>
            <Table className={adminTableComfortableSpacingClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>Gouvernorat</TableHead>
                  <TableHead>Frais (TND)</TableHead>
                  <TableHead>Dernière mise à jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feesByGovernorate.map((fee) => (
                  <TableRow key={fee.state}>
                    <TableCell align="center">
                      <div className="font-medium text-gray-900 dark:text-white">{fee.state}</div>
                    </TableCell>
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="^[0-9]+([.,][0-9]{1,2})?$"
                          value={feeDrafts[fee.state] ?? fee.fee.toFixed(2)}
                          onChange={(e) => handleFeeChange(fee.state, e.target.value)}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">TND</span>
                      </div>
                    </TableCell>
                    <TableCell align="center">
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
            <div className="flex justify-end border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={updateFeeMutation.isPending}
                loading={updateFeeMutation.isPending}
              >
                {updateFeeMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={closeConfirmModal}
            aria-label="Fermer la confirmation"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-delivery-confirm-title"
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          >
            <h3
              id="free-delivery-confirm-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {confirmModal === "activate"
                ? "Activer la livraison gratuite ?"
                : "Désactiver la livraison gratuite ?"}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {confirmModal === "activate"
                ? "Tous les gouvernorats passeront à 0 TND. Les tarifs actuels seront sauvegardés avant modification."
                : "Les tarifs de livraison seront restaurés exactement comme avant l'activation."}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={isFreeDeliveryMutationPending}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal === "activate") {
                    makeAllFreeMutation.mutate();
                    return;
                  }
                  restoreDeliveryFeesMutation.mutate();
                }}
                disabled={isFreeDeliveryMutationPending}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFreeDeliveryMutationPending ? "Application..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
