import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { getEmailValidationError, normalizeEmailValue } from "../lib/email-validation";
import { formFieldClass } from "../lib/form-field-styles";
import { usePublicProductsQuery } from "../lib/products-query";
import { subscribeToPriceSettingsUpdates } from "../lib/price-sync";
import { NAV_SECTIONS, scrollToSection } from "../lib/scroll-nav";
import PriceDisplay from "../components/ui/PriceDisplay";

interface HomeProps {
  title: string;
}

interface ReviewImage {
  _id: string;
  image: string;
  caption?: string;
}

interface PublicProduct {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
}

export default function Home({ title }: HomeProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterEmailError, setNewsletterEmailError] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");

  useEffect(() => {
    const scrollFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        requestAnimationFrame(() => scrollToSection(hash));
      }
    };

    scrollFromHash();

    const handleRouteChange = (url: string) => {
      if (url.includes("#")) {
        requestAnimationFrame(() => scrollFromHash());
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  const scrollToBoutique = (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToSection(NAV_SECTIONS.boutique);
    window.history.replaceState(null, "", `/#${NAV_SECTIONS.boutique}`);
  };

  const { data: reviewImagesData } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const response = await fetch("/api/reviews");
      const data = await response.json();
      return data.success ? (data.data as ReviewImage[]) : [];
    },
  });

  const { data: productsData } = usePublicProductsQuery();

  const { data: globalPriceData } = useQuery({
    queryKey: ["global-price-home"],
    queryFn: async () => {
      const response = await fetch("/api/price");
      const data = await response.json();
      return data.success
        ? data.data
        : {
            pricePerM2: 50,
            salePricePerM2: null,
            isSaleActive: false,
            effectivePricePerM2: 50,
          };
    },
  });

  useEffect(() => {
    return subscribeToPriceSettingsUpdates((payload) => {
      if (payload.storePrice) {
        queryClient.setQueryData(["global-price-home"], (current: Record<string, unknown> | undefined) => ({
          ...(current || {}),
          ...payload.storePrice,
        }));
      } else {
        void queryClient.invalidateQueries({ queryKey: ["global-price-home"] });
      }
    });
  }, [queryClient]);

  const products = Array.isArray(productsData) ? productsData : [];
  const listPrice = Number(globalPriceData?.pricePerM2 ?? 50);
  const reviewImages = Array.isArray(reviewImagesData) ? reviewImagesData : [];

  const handleBuyNow = (product: PublicProduct) => {
    if (!product.isAvailable) {
      return;
    }
    void router.push({
      pathname: "/configurer",
      query: {
        productId: product._id,
        productName: product.name,
        productImage: product.image || "/images/14.jpeg",
      },
    });
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Décorez Votre Espace de Rêve Avec Notre Collection d'Exception"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/logo.png" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
      </Head>

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navigation />

        {/* Hero Section */}
        <section
          id={NAV_SECTIONS.accueil}
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <Card className="overflow-hidden bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="px-8 py-12"
              >
                <h1 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white lg:text-5xl">
                  Décorez Votre Espace de Rêve Avec Notre Collection d&apos;Exception
                </h1>
                <p className="mb-8 text-lg text-gray-600 dark:text-gray-300">
                  Explorez nos collections soigneusement sélectionnées pour découvrir les pièces
                  parfaites pour votre vision unique.
                </p>
                <a
                  href={`/#${NAV_SECTIONS.boutique}`}
                  onClick={scrollToBoutique}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-gray-900 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Demander Devis
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative h-96 lg:h-[500px]"
              >
                <div className="absolute inset-0 rounded-lg bg-gray-200 dark:bg-gray-600">
                  <Image
                    src="/images/14.jpeg"
                    alt="Rideaux Bambou Collection"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="rounded-lg object-cover"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </Card>
        </section>

        {/* Boutique */}
        <section
          id={NAV_SECTIONS.boutique}
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-12 text-3xl font-bold text-gray-900 dark:text-white">
              Nos Produits
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {products.map((item, index) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card
                    padding="none"
                    className="group overflow-hidden transition-transform hover:scale-105"
                  >
                    <div className="p-4">
                      <div className="relative mb-4 h-64 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-600">
                        <Image
                          src={item.image || "/images/14.jpeg"}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform group-hover:scale-110"
                        />
                        {!item.isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/35">
                            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 shadow-sm dark:bg-gray-900/95 dark:text-red-300">
                              Hors stock
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                        <PriceDisplay
                          pricePerM2={listPrice}
                          salePricePerM2={globalPriceData?.salePricePerM2}
                          isSaleActive={globalPriceData?.isSaleActive === true}
                        />
                        <div className="mt-4">
                          <button
                            onClick={() => handleBuyNow(item)}
                            disabled={!item.isAvailable}
                            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-100 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-gray-600 dark:disabled:text-gray-300"
                          >
                            Acheter maintenant
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
            {products.length === 0 && (
              <Card className="mx-auto mt-6 max-w-2xl p-6 text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  Aucun produit n&apos;a encore été ajouté par l&apos;admin.
                </p>
              </Card>
            )}
          </motion.div>
        </section>

        {/* About Us */}
        <section
          id={NAV_SECTIONS.aPropos}
          className="relative overflow-hidden py-20 sm:py-24"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(17,24,39,0.04),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.05),_transparent_55%)]" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="mb-20 text-center sm:mb-24"
            >
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                À Propos
              </h2>
            </motion.div>

            <div className="space-y-20 sm:space-y-24">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="mx-auto mb-12 max-w-2xl text-center sm:mb-16"
                >
                  <h3 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl lg:text-3xl">
                    Pourquoi choisir nos rideaux en bambou&nbsp;?
                  </h3>
                </motion.div>

                <div className="space-y-20 sm:space-y-24">
              {/* Pics 1 & 2 — captions under */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="mx-auto grid max-w-[61.6rem] grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8 lg:gap-10"
              >
                <div>
                  <div className="overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                    <Image
                      src="/images/1.jpeg"
                      alt="Qualité premium"
                      width={800}
                      height={1000}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    Qualité premium
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                    Bambou naturel, solide et durable.
                  </p>
                </div>
                <div>
                  <div className="overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                    <Image
                      src="/images/8.jpeg"
                      alt="Fabrication sur mesure"
                      width={800}
                      height={1000}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    Fabrication sur mesure
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                    Adaptés parfaitement à vos dimensions.
                  </p>
                </div>
              </motion.div>

              {/* Design & lumière — text beside pics 4 & 9 */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="grid items-center gap-6 lg:grid-cols-[1fr_minmax(0,20rem)_minmax(0,20rem)] lg:justify-items-stretch lg:gap-8 xl:grid-cols-[1fr_minmax(0,24rem)_minmax(0,24rem)]"
              >
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                      Design élégant
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                      Apporte une touche naturelle, moderne et chaleureuse.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                      Filtrent la lumière
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                      Réduisent l’éblouissement tout en conservant une belle luminosité.
                    </p>
                  </div>
                </div>
                <div className="relative aspect-[4/5] w-full overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                  <Image
                    src="/images/4.jpeg"
                    alt="Design élégant"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24rem"
                    className="object-cover object-top"
                  />
                </div>
                <div className="relative aspect-[4/5] w-full overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                  <Image
                    src="/images/9.jpeg"
                    alt="Filtrent la lumière"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24rem"
                    className="object-cover object-top"
                  />
                </div>
              </motion.div>

              {/* Confort & entretien — pics 7 & 6, text beside */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="grid items-center gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,20rem)_1fr] lg:justify-items-stretch lg:gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,24rem)_1fr]"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                  <Image
                    src="/images/7.jpeg"
                    alt="Améliorent le confort"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24rem"
                    className="object-cover object-top"
                  />
                </div>
                <div className="relative aspect-[4/5] w-full overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                  <Image
                    src="/images/6.jpeg"
                    alt="Entretien facile"
                    fill
                    sizes="(max-width: 1024px) 100vw, 24rem"
                    className="object-cover object-top"
                  />
                </div>
                <div className="space-y-8 text-center sm:px-2 sm:text-left">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                      Améliorent le confort
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                      Limitent les rayons directs du soleil et aident à garder un espace plus
                      agréable.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                      Entretien facile
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                      Nettoyage simple et rapide.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Durables & Polyvalents — same frame as pics 1 & 2 */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="mx-auto grid max-w-[61.6rem] grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8 lg:gap-10"
              >
                <div>
                  <div className="overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                    <Image
                      src="/images/2.jpeg"
                      alt="Durables"
                      width={800}
                      height={1000}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    Durables
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                    Conçus pour résister à un usage quotidien.
                  </p>
                </div>
                <div>
                  <div className="overflow-hidden transition duration-500 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg">
                    <Image
                      src="/images/5.jpeg"
                      alt="Polyvalents"
                      width={800}
                      height={1000}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    Polyvalents
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                    Parfaits pour tous les espaces.
                  </p>
                </div>
              </motion.div>
                </div>
              </div>

              {/* Espaces */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="mx-auto max-w-2xl text-center">
                  <h3 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl lg:text-3xl">
                    Pour chaque espace
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
                    Restaurants, bureaux, boutiques ou maison — le même bambou, le bon effet.
                  </p>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      title: "Restaurants & cafés",
                      text: "Ambiance accueillante, confort des clients, style naturel haut de gamme.",
                    },
                    {
                      title: "Bureaux",
                      text: "Moins de reflets sur les écrans, confort visuel et décoration professionnelle.",
                    },
                    {
                      title: "Boutiques",
                      text: "Produits mis en valeur, vitrine soignée, image moderne qui attire le regard.",
                    },
                    {
                      title: "Cuisines",
                      text: "Protection solaire, décoration naturelle, entretien facile au quotidien.",
                    },
                    {
                      title: "Chambres",
                      text: "Lumière filtrée, intimité préservée, atmosphère calme et élégante.",
                    },
                    {
                      title: "Vérandas",
                      text: "Moins de chaleur, belle luminosité, un espace agréable toute l’année.",
                    },
                  ].map((space, index) => (
                    <motion.div
                      key={space.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: index * 0.06 }}
                      viewport={{ once: true }}
                      className="group border-t border-gray-300 pt-6 dark:border-gray-600"
                    >
                      <h4 className="text-lg font-semibold tracking-tight text-gray-900 transition-colors group-hover:text-gray-700 dark:text-white dark:group-hover:text-gray-200">
                        {space.title}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                        {space.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Confiance */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="overflow-hidden rounded-2xl bg-gray-900 px-6 py-12 dark:bg-gray-800 sm:px-10 sm:py-14"
              >
                <div className="mx-auto max-w-2xl text-center">
                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-3xl">
                    Pourquoi nous faire confiance&nbsp;?
                  </h3>
                </div>

                <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  {[
                    "Découpe 100 % sur mesure.",
                    "Matériaux de qualité.",
                    "Prix compétitifs.",
                    "Finition soignée.",
                    "Livraison rapide.",
                    "Satisfaction client au cœur de nos priorités.",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3.5 ring-1 ring-white/10"
                    >
                      <svg
                        aria-hidden
                        className="mt-0.5 h-5 w-5 shrink-0 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm leading-relaxed text-gray-200 sm:text-base">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-12 text-3xl font-bold text-gray-900 dark:text-white">
              Avis Clients
            </h2>
            {reviewImages.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {reviewImages.map((review, index) => (
                  <motion.div
                    key={review._id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card padding="none" className="h-full overflow-hidden">
                      <div className="p-4">
                        <div
                          className={`relative h-64 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 ${
                            review.caption ? "mb-4" : ""
                          }`}
                        >
                          <Image
                            src={review.image}
                            alt="Capture d'ecran d'avis client"
                            fill
                            sizes="(max-width: 768px) 100vw, 25vw"
                            className="object-cover"
                          />
                        </div>
                        <div className="text-left">
                          {review.caption && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">{review.caption}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="mx-auto max-w-2xl p-8 text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  Les avis images seront affiches ici des qu&apos;ils sont ajoutes par l&apos;admin.
                </p>
              </Card>
            )}
          </motion.div>
        </section>

        {/* Newsletter */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-600">
              <div className="absolute inset-0">
                <Image
                  src="/images/3.jpeg"
                  alt="Stores en bambou"
                  fill
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover object-center opacity-45"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900/75 via-gray-900/55 to-gray-900/70" />
              </div>
              <div className="relative px-8 py-12 text-center">
                <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                  Restez Informé des Offres Exclusives !
                </h2>
                <p className="mb-8 text-lg text-gray-200">
                  Abonnez-vous à notre newsletter pour être le premier à recevoir nos offres
                  exclusives. Découvrez les tendances et décorez votre espace de rêve avec nous.
                </p>
                <form
                  className="mx-auto flex w-full max-w-md flex-col gap-4 sm:flex-row"
                  onSubmit={async (event) => {
                      event.preventDefault();
                      const normalizedEmail = normalizeEmailValue(newsletterEmail);
                      setNewsletterEmail(normalizedEmail);
                      const validationError = getEmailValidationError(normalizedEmail, {
                        required: true,
                      });
                      setNewsletterEmailError(validationError);
                      if (validationError) {
                        return;
                      }

                      setNewsletterStatus("loading");
                      setNewsletterMessage("");

                      try {
                        const response = await fetch("/api/newsletter", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: normalizedEmail }),
                        });
                        const data = await response.json();

                        if (!response.ok || !data.success) {
                          throw new Error(data.error || "Inscription impossible.");
                        }

                        setNewsletterStatus("success");
                        setNewsletterMessage(
                          "Merci ! Vous serez informé(e) de nos prochaines promotions."
                        );
                        setNewsletterEmail("");
                      } catch (subscribeError) {
                        setNewsletterStatus("error");
                        setNewsletterMessage(
                          subscribeError instanceof Error
                            ? subscribeError.message
                            : "Inscription impossible."
                        );
                      }
                    }}
                  >
                  <input
                    type="email"
                    placeholder="Entrez votre email"
                    value={newsletterEmail}
                    onChange={(e) => {
                      const nextEmail = e.target.value;
                      setNewsletterEmail(nextEmail);
                      if (newsletterEmailError) {
                        setNewsletterEmailError(getEmailValidationError(nextEmail, { required: true }));
                      }
                    }}
                    onBlur={() => {
                      const normalizedEmail = normalizeEmailValue(newsletterEmail);
                      setNewsletterEmail(normalizedEmail);
                      setNewsletterEmailError(
                        getEmailValidationError(normalizedEmail, { required: true })
                      );
                    }}
                    className={`flex-1 ${formFieldClass}`}
                  />
                  <Button
                    type="submit"
                    disabled={Boolean(newsletterEmailError) || newsletterStatus === "loading"}
                    className="!bg-green-600 px-8 py-3 font-semibold !text-white hover:!bg-green-700 focus:!ring-green-500/50 disabled:opacity-60 dark:!bg-green-600 dark:!text-white dark:hover:!bg-green-700"
                  >
                    {newsletterStatus === "loading" ? "Inscription..." : "S'abonner"}
                  </Button>
                </form>
                {newsletterEmailError && (
                  <p className="mt-2 text-sm text-red-200">{newsletterEmailError}</p>
                )}
                {newsletterMessage && (
                  <p
                    className={`mt-2 text-sm ${
                      newsletterStatus === "success" ? "text-green-200" : "text-red-200"
                    }`}
                  >
                    {newsletterMessage}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </section>

        <Footer />
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Rideaux Bambou - Décorez Votre Espace de Rêve",
    },
  };
};
