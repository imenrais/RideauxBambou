import { useSession } from "next-auth/react";
import { useState } from "react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Loading from "../../components/ui/Loading";
import PasswordInput from "../../components/ui/PasswordInput";
import { useToast } from "../../contexts/ToastContext";
import {
  checkPasswordStrength,
  getPasswordStrengthLabel,
  strongPasswordSchema,
} from "../../lib/password-validation";

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

const PASSWORD_STRENGTH_BAR_COLORS = [
  "bg-red-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-400",
  "bg-lime-500",
  "bg-green-500",
] as const;

export default function AdminSettings() {
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const passwordStrength = checkPasswordStrength(newPassword);

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateFields = (): boolean => {
    const next: FieldErrors = {};

    if (!currentPassword.trim()) {
      next.currentPassword = "Ce champ est requis.";
    }

    if (!newPassword.trim()) {
      next.newPassword = "Ce champ est requis.";
    } else {
      const parsed = strongPasswordSchema.safeParse(newPassword);
      if (!parsed.success) {
        next.newPassword =
          parsed.error.issues[0]?.message ||
          "Le mot de passe n'est pas assez sécurisé.";
      }
    }

    if (!confirmPassword.trim()) {
      next.confirmPassword = "Ce champ est requis.";
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = "Les mots de passe ne correspondent pas.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) {
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
        const message = String(data.error || "Impossible de modifier le mot de passe");
        const lower = message.toLowerCase();

        if (lower.includes("actuel") || lower.includes("incorrect")) {
          setFieldErrors((prev) => ({
            ...prev,
            currentPassword: "Mot de passe actuel incorrect.",
          }));
          return;
        }

        if (lower.includes("correspond")) {
          setFieldErrors((prev) => ({
            ...prev,
            confirmPassword: message,
          }));
          return;
        }

        if (
          lower.includes("différent") ||
          lower.includes("minuscule") ||
          lower.includes("majuscule") ||
          lower.includes("chiffre") ||
          lower.includes("spécial") ||
          lower.includes("caractère")
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            newPassword: message,
          }));
          return;
        }

        showError(message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      success("Mot de passe modifié avec succès.");
    } catch {
      showError("Erreur lors de la modification du mot de passe");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Paramètres Admin - Rideaux Bambou" description="Paramètres administrateur">
      <div className="mb-4 sm:mb-8">
        <BackButton href="/admin" />
      </div>

      <Card className="p-4 sm:p-8 lg:p-10">
        <div className="mb-8">
          <h1 className="mb-0 text-xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Paramètres Admin
          </h1>
        </div>

        <div className="mt-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:max-w-xl sm:rounded-2xl sm:border-gray-200/80 sm:bg-gray-50/80 sm:p-8 sm:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:sm:bg-gray-800/60">
          <div className="mb-6">
            <h2 className="mb-1.5 text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
              Changer le Mot de Passe
            </h2>
            <p className="mb-0 text-sm text-gray-600 dark:text-gray-400">
              Choisissez un mot de passe fort.
            </p>
          </div>

          <form
            onSubmit={handlePasswordUpdate}
            className="max-w-md space-y-3 sm:max-w-none sm:space-y-5"
            noValidate
          >
            <PasswordInput
              id="admin-current-password"
              name="currentPassword"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                clearFieldError("currentPassword");
              }}
              placeholder="Mot de passe actuel"
              className="h-10 text-sm sm:h-11 sm:text-base"
              error={fieldErrors.currentPassword}
            />
            <div>
              <PasswordInput
                id="admin-new-password"
                name="newPassword"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearFieldError("newPassword");
                  if (confirmPassword && e.target.value === confirmPassword) {
                    clearFieldError("confirmPassword");
                  }
                }}
                placeholder="Nouveau mot de passe"
                className="h-10 text-sm sm:h-11 sm:text-base"
                error={fieldErrors.newPassword}
              />
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Sécurité</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {getPasswordStrengthLabel(passwordStrength.score)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          level <= passwordStrength.score
                            ? PASSWORD_STRENGTH_BAR_COLORS[passwordStrength.score]
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                  {!passwordStrength.isValid && passwordStrength.feedback.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Requis : {passwordStrength.feedback.join(", ").toLowerCase()}.
                    </p>
                  )}
                </div>
              )}
            </div>
            <PasswordInput
              id="admin-confirm-password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError("confirmPassword");
              }}
              placeholder="Confirmer le nouveau mot de passe"
              className="h-10 text-sm sm:h-11 sm:text-base"
              error={fieldErrors.confirmPassword}
            />
            <div className="flex justify-center pt-4 sm:justify-start sm:pt-8">
              <Button
                type="submit"
                loading={isSubmitting}
                className="h-10 px-5 text-sm sm:h-11 sm:px-8 sm:text-base"
              >
                {isSubmitting ? "Mise à jour..." : "Modifier le Mot de Passe"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </AdminLayout>
  );
}

export { requireAdminPage as getServerSideProps } from "../../lib/require-admin-page";

