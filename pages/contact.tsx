import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import { useState } from "react";
import { useToast } from "../contexts/ToastContext";

import StandardLayout from "../components/layout/StandardLayout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";
import { formFieldLabelClass, formTextareaClass } from "../lib/form-field-styles";
import { getPhoneValidationError, normalizePhoneValue } from "../lib/phone-validation";

interface ContactProps {
  title: string;
}

export default function Contact({ title }: ContactProps) {
  const { success } = useToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmailValue(email);
    const normalizedPhone = normalizePhoneValue(phone);
    const nextEmailError = getEmailValidationError(normalizedEmail, { required: true });
    const nextPhoneError = getPhoneValidationError(normalizedPhone);
    setEmail(normalizedEmail);
    setPhone(normalizedPhone);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    if (nextEmailError || nextPhoneError) {
      return;
    }
    // Handle form submission
    success("Merci pour votre message ! Nous vous contacterons bientôt.");
  };

  return (
    <StandardLayout title={title} description="Contactez-nous - Rideaux Bambou">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-8 sm:space-y-12 lg:space-y-16"
      >
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
            Contactez-nous
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 sm:mt-4 sm:text-lg">
            Nous sommes là pour vous aider à créer votre espace de rêve
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12">
          {/* Contact Form */}
          <Card className="p-4 sm:p-6 lg:p-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white sm:mb-6 sm:text-2xl">
              Envoyez-nous un message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                <div>
                  <label className={formFieldLabelClass}>
                    Prénom
                  </label>
                  <Input type="text" name="firstName" required className="w-full" />
                </div>
                <div>
                  <label className={formFieldLabelClass}>
                    Nom
                  </label>
                  <Input type="text" name="lastName" required className="w-full" />
                </div>
              </div>
              <div>
                <label className={formFieldLabelClass}>
                  Email
                </label>
                <Input
                  type="email"
                  name="email"
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
                  className="w-full"
                />
              </div>
              <div>
                <label className={formFieldLabelClass}>
                  Téléphone
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => {
                    const normalizedPhone = normalizePhoneValue(e.target.value);
                    setPhone(normalizedPhone);
                    if (phoneError) {
                      setPhoneError(getPhoneValidationError(normalizedPhone));
                    }
                  }}
                  onBlur={() => setPhoneError(getPhoneValidationError(phone))}
                  inputMode="numeric"
                  maxLength={8}
                  pattern="[0-9]*"
                  error={phoneError}
                  className="w-full"
                />
              </div>
              <div>
                <label className={formFieldLabelClass}>
                  Sujet
                </label>
                <Input type="text" name="subject" required className="w-full" />
              </div>
              <div>
                <label className={formFieldLabelClass}>
                  Message
                </label>
                <textarea
                  name="message"
                  rows={6}
                  required
                  className={formTextareaClass}
                  placeholder="Décrivez votre projet ou posez votre question..."
                />
              </div>
              <Button
                type="submit"
                disabled={Boolean(emailError) || Boolean(phoneError)}
                className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Envoyer le Message
              </Button>
            </form>
          </Card>

          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="overflow-hidden p-0">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-8 py-6 dark:from-gray-800 dark:to-gray-700">
                <h2 className="text-3xl font-bold text-white">Informations de Contact</h2>
                <p className="mt-2 text-gray-300">
                  Nous sommes là pour vous accompagner dans votre projet
                </p>
              </div>

              <div className="p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {/* Address Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700 dark:hover:shadow-gray-900"
                  >
                    <div className="absolute right-4 top-4">
                      <div className="rounded-full bg-gray-100 p-3 group-hover:bg-gray-200 dark:bg-gray-700 dark:group-hover:bg-gray-600">
                        <svg
                          className="h-6 w-6 text-gray-700 dark:text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="pr-20">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Adresse
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        11, Rue 15 Octobre 2013
                        <br />
                        Ben Arous, Tunisie
                      </p>
                    </div>
                  </motion.div>

                  {/* Phone Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700 dark:hover:shadow-gray-900"
                  >
                    <div className="absolute right-4 top-4">
                      <div className="rounded-full bg-gray-100 p-3 group-hover:bg-gray-200 dark:bg-gray-700 dark:group-hover:bg-gray-600">
                        <svg
                          className="h-6 w-6 text-gray-700 dark:text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="pr-20">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Téléphone
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <a
                          href="tel:+21651590770"
                          className="font-medium transition-colors hover:text-gray-900 dark:hover:text-white"
                        >
                          +216 51 590 770
                        </a>
                      </p>
                    </div>
                  </motion.div>

                  {/* Email Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700 dark:hover:shadow-gray-900 md:col-span-2 lg:col-span-1"
                  >
                    <div className="absolute right-4 top-4">
                      <div className="rounded-full bg-gray-100 p-3 group-hover:bg-gray-200 dark:bg-gray-700 dark:group-hover:bg-gray-600">
                        <svg
                          className="h-6 w-6 text-gray-700 dark:text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="pr-20">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email</h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <a
                          href="mailto:rideauxbambou@gmail.com"
                          className="font-medium transition-colors hover:text-gray-900 dark:hover:text-white"
                        >
                          rideauxbambou@gmail.com
                        </a>
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* Call to Action */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="mt-8 rounded-lg bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-center dark:from-gray-800 dark:to-gray-700"
                >
                  <h3 className="text-xl font-semibold text-white">
                    Prêt à commencer votre projet ?
                  </h3>
                  <p className="mt-2 text-gray-300">
                    Contactez-nous dès aujourd'hui pour une consultation gratuite
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <a
                      href="tel:+21651590770"
                      className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      Appeler Maintenant
                    </a>
                    <a
                      href="mailto:rideauxbambou@gmail.com"
                      className="inline-flex items-center justify-center rounded-lg border border-white px-6 py-3 font-semibold text-white transition-colors hover:bg-white hover:text-gray-900"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Envoyer un Email
                    </a>
                  </div>
                </motion.div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 lg:p-8">
              <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                Pourquoi nous choisir ?
              </h2>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Produits de qualité supérieure</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Service client personnalisé</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Livraison rapide en Tunisie</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Pose professionnelle</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </motion.div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Contactez-nous - Rideaux Bambou",
    },
  };
};
