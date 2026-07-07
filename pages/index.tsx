import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect } from "react";

import Footer from "../components/Footer";
import Navigation from "../components/Navigation";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { NAV_SECTIONS, scrollToSection } from "../lib/scroll-nav";

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
}

export default function Home({ title }: HomeProps) {
  const router = useRouter();

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

  const { data: productsData } = useQuery({
    queryKey: ["products-home"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      const data = await response.json();
      return data.success ? (data.data as PublicProduct[]) : [];
    },
  });

  const { data: globalPriceData } = useQuery({
    queryKey: ["global-price-home"],
    queryFn: async () => {
      const response = await fetch("/api/price");
      const data = await response.json();
      return data.success ? (data.data as { pricePerM2: number }) : { pricePerM2: 50 };
    },
  });

  const products = Array.isArray(productsData) ? productsData : [];
  const globalPrice = Number(globalPriceData?.pricePerM2 ?? 50);
  const reviewImages = Array.isArray(reviewImagesData) ? reviewImagesData : [];

  const handleBuyNow = (product: PublicProduct) => {
    void router.push({
      pathname: "/configurer",
      query: {
        productId: product._id,
        productName: product.name,
        productImage: product.image || "/14.jpeg",
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
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation />

        {/* Hero Section */}
        <section
          id={NAV_SECTIONS.accueil}
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <Card className="overflow-hidden bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="px-8 py-12"
              >
                <h1 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white lg:text-5xl">
                  Décorez Votre Espace de Rêve Avec Notre Collection d'Exception
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
                    src="/14.jpeg"
                    alt="Rideaux Bambou Collection"
                    fill
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
                          src={item.image || "/14.jpeg"}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-110"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {globalPrice.toFixed(2)} TND/m²
                        </p>
                        <div className="mt-4">
                          <button
                            onClick={() => handleBuyNow(item)}
                            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
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
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">À Propos</h2>
            <p className="mx-auto mb-10 max-w-2xl text-base text-gray-600 dark:text-gray-300 sm:text-lg">
              L'alliance parfaite entre lumière naturelle, confort thermique et élégance artisanale.
            </p>
            <Card className="mx-auto max-w-5xl overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-white to-green-50 p-0 shadow-xl dark:from-gray-800 dark:via-gray-800 dark:to-gray-900">
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-5">
                <div className="p-8 text-left lg:col-span-3 lg:p-10">
                  <h3 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
                    Une ambiance premium, pensée pour votre quotidien
                  </h3>
                  <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                    Nos rideaux en bambou laissent passer environ{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      25% de lumière
                    </span>{" "}
                    pour préserver la clarté naturelle, tout en agissant comme un{" "}
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      barrage thermique
                    </span>{" "}
                    qui améliore le confort intérieur. Chaque finition reflète un véritable{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">artisanat</span>,
                    pour un résultat riche, raffiné et durable.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 bg-white/60 p-6 backdrop-blur-sm dark:bg-gray-900/40 lg:col-span-2 lg:p-8">
                  <div className="rounded-xl border border-amber-200 bg-amber-100/80 px-4 py-4 text-left dark:border-amber-700/40 dark:bg-amber-900/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      Lumière maîtrisée
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                      25% de lumière passe
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-100/80 px-4 py-4 text-left dark:border-green-700/40 dark:bg-green-900/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300">
                      Confort intérieur
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                      Barrage thermique
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-300 bg-gray-100/80 px-4 py-4 text-left dark:border-gray-600 dark:bg-gray-800/80">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                      Signature qualité
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">Artisanat</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
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
                  Les avis images seront affiches ici des qu'ils sont ajoutes par l'admin.
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
                  src="/14.jpeg"
                  alt="Newsletter Background"
                  fill
                  className="object-cover opacity-20"
                />
              </div>
              <div className="relative px-8 py-12 text-center">
                <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                  Restez Informé des Offres Exclusives !
                </h2>
                <p className="mb-8 text-lg text-gray-200">
                  Abonnez-vous à notre newsletter pour être le premier à recevoir nos offres
                  exclusives. Découvrez les tendances et décorez votre espace de rêve avec nous.
                </p>
                <div className="mx-auto flex max-w-md flex-col gap-4 sm:flex-row">
                  <input
                    type="email"
                    placeholder="Entrez votre email"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <Button className="bg-white px-8 py-3 font-semibold text-gray-900 hover:bg-gray-100">
                    S'abonner
                  </Button>
                </div>
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
