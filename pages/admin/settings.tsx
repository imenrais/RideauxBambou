import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";

interface AdminSettingsProps {
  title: string;
}

export default function AdminSettings({ title }: AdminSettingsProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError, warning } = useToast();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      void router.push("/login");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      warning("Veuillez remplir tous les champs.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible de modifier le mot de passe");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      success("Mot de passe modifié avec succès.");
    } catch (requestError) {
      showError(
        requestError instanceof Error
          ? requestError.message
          : "Erreur lors de la modification du mot de passe"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title={title} description="Paramètres administrateur">
      <div className="mb-6">
        <BackButton href="/admin" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="p-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Paramètres Admin</h1>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Changer le Mot de Passe
            </h2>
            <form onSubmit={handlePasswordUpdate} className="max-w-md space-y-3">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mot de passe actuel"
                className="h-10 text-sm"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="h-10 text-sm"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
                className="h-10 text-sm"
              />
              <Button type="submit" loading={isSubmitting} className="mt-2 h-10 px-5 text-sm">
                {isSubmitting ? "Mise à jour..." : "Modifier le Mot de Passe"}
              </Button>
            </form>
          </div>
        </Card>
      </motion.div>
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Paramètres Admin - Rideaux Bambou");
