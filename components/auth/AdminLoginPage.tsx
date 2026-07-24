import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { signIn, getSession, signOut } from "next-auth/react";
import { useState } from "react";

import BackButton from "../BackButton";
import StandardLayout from "../layout/StandardLayout";
import Button from "../ui/Button";
import Input from "../ui/Input";
import PasswordInput from "../ui/PasswordInput";
import { getEmailValidationError, normalizeEmailValue } from "../../lib/email-validation";

interface LoginPageProps {
  title: string;
}

export default function LoginPage({ title }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      setEmailError(getEmailValidationError(value, { required: true }));
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeEmailValue(email);
    const validationError = getEmailValidationError(normalizedEmail, { required: true });
    setEmail(normalizedEmail);
    setEmailError(validationError);
    if (validationError) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        portal: "admin",
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect");
      } else {
        // Check if user is admin and redirect accordingly
        const session = await getSession();
        if (session?.user?.role === "admin") {
          router.push("/admin");
        } else {
          setError("Accès administrateur requis");
          await signOut({ redirect: false });
        }
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StandardLayout title={title} description="Connexion" showCartIcon={false}>
      <div className="-mx-4 -my-8 min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        {/* Back Button and Main Content */}
        <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          <BackButton href="/" />

          {/* Main Content */}
          <main className="mx-auto w-full max-w-md px-0 pb-12 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="rounded-3xl border border-gray-200/50 bg-white/80 p-6 shadow-2xl ring-1 ring-gray-200/20 backdrop-blur-sm sm:p-8 dark:border-gray-700/50 dark:bg-gray-800/80 dark:ring-gray-700/20"
            >
              {/* Header */}
              <div className="mb-8 text-center">
                <img
                  src="/images/logo.png"
                  alt="Rideaux Bambou"
                  className="mx-auto mb-4 h-12 w-12 object-contain"
                />
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Connexion
                </h2>
                <p className="text-gray-600 dark:text-gray-400">Accès réservé</p>
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

              {/* Email/Password Form */}
              <form onSubmit={handleEmailLogin} className="space-y-6">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Adresse email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => {
                    const normalizedEmail = normalizeEmailValue(email);
                    setEmail(normalizedEmail);
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="mt-2 text-left">
                    <Link
                      href="/mot-de-passe-oublie"
                      className="text-sm font-medium text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-white"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading || Boolean(emailError)}
                  className="w-full"
                >
                  {isLoading ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </motion.div>
          </main>
        </div>
      </div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Cache-Control", "no-store");
  return {
    props: {
      title: "Connexion - Rideaux Bambou",
    },
  };
};
