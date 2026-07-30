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

function ProductCard({
  item,
  listPrice,
  salePricePerM2,
  isSaleActive,
  onBuyNow,
}: {
  item: PublicProduct;
  listPrice: number;
  salePricePerM2?: number | null;
  isSaleActive: boolean;
  onBuyNow: (product: PublicProduct) => void;
}) {
  const [isImagePopped, setIsImagePopped] = useState(false);

  return (
    <div className="w-[min(72vw,260px)] shrink-0 md:w-auto md:shrink">
      <Card
        padding="none"
        className={`h-full overflow-hidden transition-transform duration-300 ${
          isImagePopped ? "scale-[1.02]" : "scale-100"
        }`}
      >
        <div className="overflow-hidden p-4">
          <div
            className="relative mb-3 h-40 touch-manipulation overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-600 sm:mb-4 sm:h-52"
            onMouseEnter={() => setIsImagePopped(true)}
            onMouseLeave={() => setIsImagePopped(false)}
            onPointerDown={() => setIsImagePopped(true)}
            onPointerUp={() => setIsImagePopped(false)}
            onPointerCancel={() => setIsImagePopped(false)}
            onPointerLeave={() => setIsImagePopped(false)}
          >
            {item.image ? (
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 768px) 72vw, (max-width: 1024px) 45vw, 30vw"
                draggable={false}
                className={`select-none object-cover transition-transform duration-300 ease-out ${
                  isImagePopped ? "scale-110" : "scale-100"
                }`}
              />
            ) : null}
            {!item.isAvailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/35">
                <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 shadow-sm dark:bg-gray-900/95 dark:text-red-300">
                  Hors stock
                </span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
              {item.name}
            </h3>
            <div className="flex justify-center">
              <PriceDisplay
                pricePerM2={listPrice}
                salePricePerM2={salePricePerM2}
                isSaleActive={isSaleActive}
              />
            </div>
            <div className="mt-3 flex justify-center sm:mt-4">
              <button
                type="button"
                onClick={() => onBuyNow(item)}
                disabled={!item.isAvailable}
                className="rounded-lg bg-gray-900 px-[1.55rem] py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-100 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-gray-600 dark:disabled:text-gray-300 sm:px-[6.4rem]"
              >
                Acheter maintenant
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
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
  const reviewImages = (Array.isArray(reviewImagesData) ? reviewImagesData : []).filter(
    (review) => Boolean(review.image?.trim())
  );

  const handleBuyNow = (product: PublicProduct) => {
    if (!product.isAvailable) {
      return;
    }
    void router.push({
      pathname: "/configurer",
      query: {
        productId: product._id,
        productName: product.name,
        productImage: product.image || "",
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="icon" href="/images/logo.png" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
      </Head>

      <div className="min-h-dvh bg-gray-100 dark:bg-gray-900">
        <Navigation />

        <div className="overflow-x-clip">

        {/* Hero Section */}
        <section
          id={NAV_SECTIONS.accueil}
          className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10 lg:px-8 lg:py-16"
        >
          {/* Phone / tablet: compact photo hero */}
          <Card
            padding="none"
            className="relative overflow-hidden !border-0 bg-gray-900 shadow-md lg:hidden"
          >
            <div className="relative aspect-[600/420] w-full overflow-hidden">
              <Image
                src="/images/14.jpeg"
                alt="Rideaux Bambou Collection"
                fill
                sizes="100vw"
                className="object-cover object-center"
                priority
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent to-70%" />
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col items-start justify-center px-4 py-4 text-left sm:px-8"
            >
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="mb-3.5 max-w-[17.5rem] text-[1.05rem] font-bold leading-snug tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] sm:mb-4 sm:max-w-sm sm:text-3xl"
              >
                Décorez Votre Espace de Rêve{" "}
                <br className="sm:hidden" />
                Avec Notre Collection d&apos;Exception
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16 }}
                className="mb-5 max-w-[15rem] text-[11px] leading-relaxed text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] sm:mb-7 sm:max-w-xs sm:text-base"
              >
                Explorez nos collections soigneusement sélectionnées pour découvrir les pièces
                parfaites pour votre vision unique.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.24 }}
              >
                <a
                  href={`/#${NAV_SECTIONS.boutique}`}
                  onClick={scrollToBoutique}
                  className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-lg bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm backdrop-blur-[2px] transition active:scale-[0.98] hover:bg-white sm:min-h-0 sm:px-7 sm:py-3 sm:text-base"
                >
                  Demander Devis
                </a>
              </motion.div>
            </motion.div>
          </Card>

          {/* Desktop: text + picture side by side */}
          <Card className="hidden overflow-hidden bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 lg:block">
            <div className="grid grid-cols-2 items-center gap-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="px-8 py-12"
              >
                <h1 className="mb-8 text-4xl font-bold leading-tight text-gray-900 dark:text-white lg:mb-10 lg:text-5xl">
                  Décorez Votre Espace de Rêve
                  <br />
                  Avec Notre Collection&nbsp;d&apos;Exception
                </h1>
                <p className="mb-10 text-lg leading-relaxed text-gray-600 dark:text-gray-300 lg:mb-12">
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
                className="relative h-[480px] w-full"
              >
                <div className="absolute inset-0 rounded-lg bg-gray-200 dark:bg-gray-600">
                  <Image
                    src="/images/14.jpeg"
                    alt="Rideaux Bambou Collection"
                    fill
                    sizes="50vw"
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
          className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-8 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:mb-12 sm:text-3xl">
              Nos Produits
            </h2>
            <div className="-mx-3 flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 pb-2 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:overscroll-auto md:px-0 md:pb-0 md:touch-auto md:[-ms-overflow-style:auto] md:[scrollbar-width:auto] lg:grid-cols-3 [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
              {products.map((item) => (
                <ProductCard
                  key={item._id}
                  item={item}
                  listPrice={listPrice}
                  salePricePerM2={globalPriceData?.salePricePerM2}
                  isSaleActive={globalPriceData?.isSaleActive === true}
                  onBuyNow={handleBuyNow}
                />
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
          className="relative overflow-hidden py-8 sm:py-12 lg:py-16"
        >
          <div className="relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              viewport={{ once: true }}
              className="mb-5 text-center sm:mb-8"
            >
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                À Propos
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:mt-2 sm:text-base">
                Bambou naturel, sur mesure — pour un intérieur plus beau et plus confortable.
              </p>
            </motion.div>

            {/* Core benefits — image-led, short copy */}
            <div className="-mx-3 flex gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-2 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:overscroll-auto sm:px-0 sm:py-0 sm:touch-auto lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
              {[
                {
                  src: "/images/1.jpeg",
                  title: "Qualité premium",
                  text: "Bambou naturel, solide et durable.",
                },
                {
                  src: "/images/8.jpeg",
                  title: "Fabrication sur mesure",
                  text: "Adaptés parfaitement à vos dimensions.",
                },
                {
                  src: "/images/4.jpeg",
                  title: "Design élégant",
                  text: "Touche naturelle, moderne et chaleureuse.",
                },
                {
                  src: "/images/9.jpeg",
                  title: "Filtrent la lumière",
                  text: "Moins d’éblouissement, belle luminosité.",
                },
                {
                  src: "/images/7.jpeg",
                  title: "Améliorent le confort",
                  text: "Moins de soleil direct, espace plus agréable.",
                },
                {
                  src: "/images/6.jpeg",
                  title: "Entretien facile",
                  text: "Nettoyage simple et rapide.",
                },
                {
                  src: "/images/2.jpeg",
                  title: "Durables",
                  text: "Conçus pour un usage quotidien.",
                },
                {
                  src: "/images/5.jpeg",
                  title: "Polyvalents",
                  text: "Parfaits pour tous les espaces.",
                },
              ].map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
                  viewport={{ once: true }}
                  className="group relative z-0 w-[68vw] max-w-[240px] shrink-0 origin-center overflow-hidden rounded-2xl shadow-sm transition duration-300 hover:z-20 hover:scale-105 hover:shadow-xl active:z-20 active:scale-105 active:shadow-xl sm:w-auto sm:max-w-none sm:hover:-translate-y-1.5"
                >
                  <div className="relative aspect-[3/4] sm:aspect-[4/5]">
                    <Image
                      src={item.src}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-110 group-active:scale-110"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition duration-300 group-hover:from-black/65" />
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                      <h3 className="text-sm font-semibold text-white sm:text-base">{item.title}</h3>
                      <p className="mt-0.5 text-[11px] leading-snug text-white/85 sm:text-sm">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

            {/* Spaces — compact labels */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              viewport={{ once: true }}
              className="mt-8 text-center sm:mt-10"
            >
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 sm:text-sm">
                Parfait pour
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-4 sm:gap-2.5">
                {["Maison", "Restaurants", "Bureaux", "Boutiques", "Vérandas"].map((space) => (
                  <span
                    key={space}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200/90 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {space}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Trust — short, punchy */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              viewport={{ once: true }}
              className="mt-8 sm:mt-10"
            >
              <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-gray-900 dark:bg-gray-800 sm:grid-cols-4">
                {[
                  {
                    label: "Découpe 100 % sur mesure",
                    icon: (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 7h16M4 12h10M4 17h7"
                      />
                    ),
                  },
                  {
                    label: "Matériaux de qualité",
                    icon: (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5.1L12 14.8 7.5 16.8l.9-5.1L4.8 8.2l5-.7L12 3z"
                      />
                    ),
                  },
                  {
                    label: "Prix compétitifs",
                    icon: (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"
                      />
                    ),
                  },
                  {
                    label: "Livraison rapide",
                    icon: (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7h11v8H3V7zm11 2h4l3 3v3h-7V9zM6.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                      />
                    ),
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`flex flex-col items-center justify-center gap-2 px-3 py-5 text-center sm:gap-2.5 sm:px-4 sm:py-6 ${
                      index % 2 === 0 ? "border-r border-white/10" : ""
                    } ${index < 2 ? "border-b border-white/10 sm:border-b-0" : ""} ${
                      index < 3 ? "sm:border-r sm:border-white/10" : "sm:border-r-0"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 sm:h-10 sm:w-10">
                      <svg
                        aria-hidden
                        className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        {item.icon}
                      </svg>
                    </span>
                    <span className="text-[11px] font-semibold leading-snug text-white sm:text-sm">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Reviews — section always visible; cards only when images exist */}
        <section className="mx-auto max-w-7xl px-3 pt-8 pb-36 sm:px-6 sm:pt-12 sm:pb-44 lg:px-8 lg:pb-48">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-8 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:mb-12 sm:text-3xl">
              Avis Clients
            </h2>
            {reviewImages.length > 0 ? (
              <div className="-mx-3 flex items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 pb-2 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:items-start md:gap-6 md:overflow-visible md:overscroll-auto md:px-0 md:pb-0 md:touch-auto md:[-ms-overflow-style:auto] md:[scrollbar-width:auto] lg:grid-cols-3 [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
                {reviewImages.map((review) => (
                  <div
                    key={review._id}
                    className="w-[min(78vw,280px)] shrink-0 md:w-auto md:shrink"
                  >
                    <Card padding="none" className="overflow-hidden">
                      <div className="p-3 sm:p-4">
                        <div
                          className={`overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 ${
                            review.caption ? "mb-3 sm:mb-4" : ""
                          }`}
                        >
                          <Image
                            src={review.image}
                            alt="Capture d'écran d'avis client"
                            width={720}
                            height={900}
                            sizes="(max-width: 768px) 78vw, (max-width: 1024px) 45vw, 30vw"
                            draggable={false}
                            className="pointer-events-none h-auto w-full select-none md:pointer-events-auto"
                            style={{ width: "100%", height: "auto" }}
                          />
                        </div>
                        {review.caption ? (
                          <p className="text-left text-sm text-gray-600 dark:text-gray-300">
                            {review.caption}
                          </p>
                        ) : null}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>
        </section>

        {/* Newsletter — bottom padding matches footer top padding above "Rideaux Bambou" */}
        <section className="mx-auto max-w-7xl px-3 pt-2 pb-6 sm:px-6 sm:pt-3 sm:pb-12 lg:px-8 lg:pt-4 lg:pb-12">
          <div className="relative overflow-hidden rounded-xl bg-gray-900 shadow-md">
            {/* CSS background — reliable on mobile (Next Image fill can fail inside motion/transforms) */}
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-55 sm:opacity-45"
              style={{ backgroundImage: "url('/images/3.jpeg')" }}
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-gray-900/70 via-gray-900/50 to-gray-900/60 sm:from-gray-900/80 sm:via-gray-900/60 sm:to-gray-900/70" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative z-10 px-4 py-5 text-center sm:px-8 sm:py-12 lg:px-12 lg:py-16"
            >
                <h2 className="mb-2 text-lg font-bold leading-snug text-white sm:mb-4 sm:text-3xl lg:text-4xl">
                  Restez Informé des Offres Exclusives !
                </h2>
                <p className="mx-auto mb-5 max-w-sm text-xs leading-relaxed text-gray-200 sm:mb-8 sm:max-w-xl sm:text-base lg:text-lg">
                  Abonnez-vous à notre newsletter pour être le premier à recevoir nos offres
                  exclusives.
                </p>
                <form
                  className="mx-auto w-full max-w-md"
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
                  <div className="mx-auto flex w-[80%] items-center gap-1.5 sm:w-full sm:gap-4">
                    <input
                      type="email"
                      placeholder="Votre email"
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
                      className={`${formFieldClass} !h-8 !min-h-0 min-w-0 !flex-1 !rounded-lg !px-2.5 !py-1.5 !text-xs sm:!h-auto sm:!px-3 sm:!py-2 sm:!text-sm`}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={newsletterStatus === "loading"}
                      disabled={Boolean(newsletterEmailError) || newsletterStatus === "loading"}
                      className="!h-8 !min-h-0 shrink-0 !rounded-lg !bg-green-600 !px-2.5 !py-1.5 !text-[11px] font-semibold !text-white hover:!bg-green-700 focus:!ring-green-500/50 disabled:opacity-60 sm:!h-auto sm:!px-8 sm:!py-3 sm:!text-base dark:!bg-green-600 dark:!text-white dark:hover:!bg-green-700"
                    >
                      S&apos;abonner
                    </Button>
                  </div>
                </form>
                {newsletterEmailError && (
                  <p className="mt-2 text-xs text-red-200 sm:text-sm">{newsletterEmailError}</p>
                )}
                {newsletterMessage && (
                  <p
                    className={`mt-2 text-xs sm:text-sm ${
                      newsletterStatus === "success" ? "text-green-200" : "text-red-200"
                    }`}
                  >
                    {newsletterMessage}
                  </p>
                )}
            </motion.div>
          </div>
        </section>
        </div>

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
