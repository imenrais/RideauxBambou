import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useState } from "react";

import BackButton from "../components/BackButton";
import StandardLayout from "../components/layout/StandardLayout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import PasswordInput from "../components/ui/PasswordInput";
import {
  checkPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
} from "../lib/password-validation";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";

interface SignupPageProps {
  title: string;
}

export default function SignupPage({ title }: SignupPageProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [] as string[],
    isValid: false,
  });
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    if (name === "email" && emailError) {
      setEmailError(getEmailValidationError(value, { required: true }));
    }

    // Check password strength when password changes
    if (name === "password") {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const normalizedEmail = normalizeEmailValue(formData.email);
    const validationError = getEmailValidationError(normalizedEmail, { required: true });
    setFormData((prev) => ({ ...prev, email: normalizedEmail }));
    setEmailError(validationError);
    if (validationError) {
      setIsLoading(false);
      return;
    }

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      setIsLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError("Le mot de passe ne respecte pas les critères de sécurité requis");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: normalizedEmail,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Auto login after successful signup
        setTimeout(async () => {
          await signIn("credentials", {
            email: normalizedEmail,
            password: formData.password,
            redirect: false,
          });
          router.push("/");
        }, 2000);
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (error) {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError("");

    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Google signup error:", error);
      setError("Erreur lors de l'inscription avec Google");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <StandardLayout title="Inscription Réussie - Rideaux Bambou">
        <div className="-mx-4 -my-8 min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
          {/* Back Button */}
          <div className="px-6 py-8">
            <BackButton href="/" />
          </div>

          <main className="mx-auto w-full max-w-md px-0 pb-12 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="rounded-3xl border border-gray-200/50 bg-white/80 p-6 text-center shadow-2xl ring-1 ring-gray-200/20 backdrop-blur-sm sm:p-8 dark:border-gray-700/50 dark:bg-gray-800/80 dark:ring-gray-700/20"
            >
              <div className="mb-4 text-6xl">🎉</div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                Inscription Réussie!
              </h1>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                Votre compte a été créé avec succès. Vous allez être connecté automatiquement...
              </p>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white"></div>
            </motion.div>
          </main>
        </div>
      </StandardLayout>
    );
  }

  return (
    <StandardLayout title={title} description="Inscription - Rideaux Bambou">
      <div className="-mx-4 -my-8 min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        {/* Back Button and Main Content */}
        <div className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-6">
            <BackButton href="/" />

            {/* Main Content */}
            <main className="mx-auto w-full max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="rounded-3xl border border-gray-200/50 bg-white/80 p-6 shadow-2xl ring-1 ring-gray-200/20 backdrop-blur-sm sm:p-8 dark:border-gray-700/50 dark:bg-gray-800/80 dark:ring-gray-700/20"
              >
                <div className="mb-8 text-center">
                  <img
                    src="/images/logo.jpeg"
                    alt="Rideaux Bambou"
                    className="mx-auto mb-4 h-12 w-12 object-contain"
                  />
                  <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                    Créer un Compte
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">Rejoignez Rideaux Bambou</p>
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

                {/* Signup Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      label="Prénom"
                      placeholder="Prénom"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                    />

                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      label="Nom"
                      placeholder="Nom"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <Input
                    id="email"
                    name="email"
                    type="email"
                    label="Adresse email"
                    placeholder="votre@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={() => {
                      const normalizedEmail = normalizeEmailValue(formData.email);
                      setFormData((prev) => ({ ...prev, email: normalizedEmail }));
                      setEmailError(getEmailValidationError(normalizedEmail, { required: true }));
                    }}
                    error={emailError}
                    required
                  />

                  <div>
                    <PasswordInput
                      id="password"
                      name="password"
                      label="Mot de passe"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />

                    {/* Password Strength Indicator */}
                    {formData.password && (
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

                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    label="Confirmer le mot de passe"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                    disabled={isLoading || Boolean(emailError)}
                    className="w-full"
                  >
                    {isLoading ? "Création du compte..." : "Créer mon compte"}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500 dark:bg-gray-800">Ou</span>
                  </div>
                </div>

                {/* Google Signup */}
                <Button
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                  variant="secondary"
                  fullWidth
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  }
                  iconPosition="left"
                >
                  S'inscrire avec Google
                </Button>
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Inscription - Rideaux Bambou",
    },
  };
};
