import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";

import BackButton from "../components/BackButton";
import StandardLayout from "../components/layout/StandardLayout";
import PasswordInput from "../components/ui/PasswordInput";
import {
  checkPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
} from "../lib/password-validation";

interface ResetPasswordPageProps {
  title: string;
  token: string;
}

export default function ResetPasswordPage({ title, token }: ResetPasswordPageProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [] as string[],
    isValid: false,
  });
  const handleBackNavigation = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    void router.push("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        text: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    // Validate password strength
    if (!passwordStrength.isValid) {
      setMessage({
        type: "error",
        text: "Le mot de passe ne respecte pas les critères de sécurité requis.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
        });
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Une erreur est survenue. Veuillez réessayer.",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Une erreur est survenue. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StandardLayout title={title} description="Réinitialiser votre mot de passe">
      <div className="-mx-4 -my-8 min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        {/* Back Button and Main Content */}
        <div className="px-4 py-6 sm:px-6 sm:py-8">
          <BackButton />

          {/* Main Content */}
          <main className="mx-auto w-full max-w-md">
            {/* Reset Password Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="rounded-3xl border border-gray-200/50 bg-white/80 p-6 shadow-2xl ring-1 ring-gray-200/20 backdrop-blur-sm sm:p-8 dark:border-gray-700/50 dark:bg-gray-800/80 dark:ring-gray-700/20"
            >
              <div className="mb-8 text-center">
                <Image
                  src="/images/logo.png"
                  alt="Rideaux Bambou"
                  width={48}
                  height={48}
                  className="mx-auto mb-4 object-contain"
                />
                <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                  Nouveau mot de passe
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Entrez votre nouveau mot de passe
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="mt-1">
                    <PasswordInput
                      id="password"
                      name="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        const strength = checkPasswordStrength(e.target.value);
                        setPasswordStrength(strength);
                      }}
                      placeholder="Entrez votre nouveau mot de passe"
                      required
                    />
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Force du mot de passe:
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            passwordStrength.score >= 4
                              ? "text-green-600"
                              : passwordStrength.score >= 3
                                ? "text-yellow-600"
                                : passwordStrength.score >= 2
                                  ? "text-orange-600"
                                  : "text-red-600"
                          }`}
                        >
                          {getPasswordStrengthLabel(passwordStrength.score)}
                        </span>
                      </div>

                      {/* Strength Bar */}
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                              level <= passwordStrength.score
                                ? getPasswordStrengthColor(passwordStrength.score)
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Requirements List */}
                      {passwordStrength.feedback.length > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <p className="mb-1">Le mot de passe doit contenir:</p>
                          <ul className="space-y-1">
                            {passwordStrength.feedback.map((requirement, index) => (
                              <li key={index} className="flex items-center">
                                <span className="mr-2 text-red-500">✗</span>
                                {requirement}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {passwordStrength.isValid && (
                        <div className="text-xs text-green-600 dark:text-green-400">
                          <p className="flex items-center">
                            <span className="mr-2">✓</span>
                            Mot de passe sécurisé
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="mt-1">
                    <PasswordInput
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmez votre nouveau mot de passe"
                      required
                    />
                  </div>
                </div>

                {/* Message Display */}
                {message && (
                  <div
                    className={`rounded-md p-4 ${
                      message.type === "success"
                        ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    {isLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
                  </button>
                </div>

                {/* Back to Login Link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    className="text-sm text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-white"
                  >
                    Retour à la connexion
                  </button>
                </div>
              </form>
            </motion.div>
          </main>
        </div>
      </div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { token } = context.query;

  if (!token || typeof token !== "string") {
    return {
      redirect: {
        destination: "/mot-de-passe-oublie",
        permanent: false,
      },
    };
  }

  return {
    props: {
      title: "Réinitialiser le mot de passe",
      token: token as string,
    },
  };
};
