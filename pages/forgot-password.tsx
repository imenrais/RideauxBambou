import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import BackButton from "../components/BackButton";
import StandardLayout from "../components/layout/StandardLayout";
import Input from "../components/ui/Input";
import { authCardClass, authContentClass } from "../lib/design-system";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";

interface ForgotPasswordPageProps {
  title: string;
}

export default function ForgotPasswordPage({ title }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);
    setResetUrl("");

    const normalizedEmail = normalizeEmailValue(email);
    const validationError = getEmailValidationError(normalizedEmail, { required: true });
    setEmail(normalizedEmail);
    setEmailError(validationError);
    if (validationError) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
        setEmail("");
      } else {
        setError(data.message || data.error || "Une erreur est survenue. Veuillez réessayer.");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StandardLayout title={title} description="Réinitialiser votre mot de passe">
      <div className={authContentClass}>
        {/* Back Button and Main Content */}
        <div className="px-4 py-6 sm:px-6 sm:py-8">
          <BackButton href="/connexion" />

          {/* Main Content */}
          <main className="mx-auto w-full max-w-md px-0 pb-12 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className={authCardClass}
            >
              {/* Header */}
              <div className="mb-8 text-center">
                <Image
                  src="/logo.png"
                  alt="Rideaux Bambou"
                  width={48}
                  height={48}
                  className="mx-auto mb-4 object-contain"
                />
                <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                  Mot de passe oublié ?
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Entrez votre email pour recevoir un lien de réinitialisation
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                >
                  {error}
                </motion.div>
              )}

              {/* Success Message */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
                >
                  <div className="flex items-start">
                    <svg
                      className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0"
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
                    <div className="flex-1">
                      <p className="mb-2 text-sm font-semibold">
                        {resetUrl ? "⚠️ Mode Développement - Email non configuré" : ""}
                      </p>
                      <p className="text-sm">
                        {resetUrl
                          ? "Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe:"
                          : "Un email de réinitialisation a été envoyé à votre adresse email. Vérifiez votre boîte de réception."}
                      </p>
                      {resetUrl && (
                        <div className="mt-4 rounded border-2 border-green-400 bg-white p-4 shadow-md dark:border-green-600 dark:bg-gray-700">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                            🔗 Lien de réinitialisation:
                          </p>
                          <a
                            href={resetUrl}
                            className="block break-all rounded bg-gray-50 p-3 text-sm font-medium text-green-600 hover:text-green-700 dark:bg-gray-800 dark:text-green-400 dark:hover:text-green-300"
                          >
                            {resetUrl}
                          </a>
                          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                            💡 Cliquez sur ce lien pour ouvrir la page de réinitialisation
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Adresse email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) {
                      setEmailError(getEmailValidationError(e.target.value, { required: true }));
                    }
                  }}
                  onBlur={() => {
                    const normalizedEmail = normalizeEmailValue(email);
                    setEmail(normalizedEmail);
                    setEmailError(getEmailValidationError(normalizedEmail, { required: true }));
                  }}
                  error={emailError}
                  required
                  autoComplete="email"
                />

                <motion.button
                  type="submit"
                  disabled={isLoading || Boolean(emailError)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 font-medium text-white transition-all duration-200 hover:from-green-700 hover:to-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Envoi en cours...
                    </div>
                  ) : (
                    "Envoyer le lien de réinitialisation"
                  )}
                </motion.button>
              </form>

              {/* Back to Login */}
              <div className="mt-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Vous avez votre mot de passe?{" "}
                  <Link
                    href="/connexion"
                    className="text-green-600 hover:underline dark:text-green-400"
                  >
                    Se connecter
                  </Link>
                </p>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Mot de passe oublié - Rideaux Bambou",
    },
  };
};
