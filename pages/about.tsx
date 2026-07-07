import { motion } from "framer-motion";
import { GetServerSideProps } from "next";

import StandardLayout from "../components/layout/StandardLayout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

interface AboutProps {
  title: string;
}

export default function About({ title }: AboutProps) {
  const values = [
    {
      title: "Qualité Supérieure",
      description:
        "Nous sélectionnons uniquement les meilleurs matériaux pour nos rideaux et accessoires.",
      icon: "⭐",
    },
    {
      title: "Artisanat Local",
      description: "Nous soutenons les artisans tunisiens et leurs techniques traditionnelles.",
      icon: "🏺",
    },
    {
      title: "Service Personnalisé",
      description: "Chaque client reçoit une attention personnalisée pour créer son espace unique.",
      icon: "👥",
    },
    {
      title: "Durabilité",
      description: "Nos produits sont conçus pour durer et résister à l'épreuve du temps.",
      icon: "🌱",
    },
  ];

  const team = [
    {
      name: "Ahmed Ben Ali",
      role: "Fondateur & Directeur",
      description:
        "Passionné de décoration depuis plus de 15 ans, Ahmed a créé Rideaux Bambou pour partager sa vision de l'art de vivre tunisien.",
      image: "/14.jpeg",
    },
    {
      name: "Fatma Trabelsi",
      role: "Designer en Chef",
      description:
        "Diplômée en design d'intérieur, Fatma apporte une touche moderne et élégante à nos collections.",
      image: "/14.jpeg",
    },
    {
      name: "Mohamed Khelil",
      role: "Responsable Production",
      description:
        "Expert en textiles et matériaux naturels, Mohamed supervise la qualité de chaque produit.",
      image: "/14.jpeg",
    },
  ];

  return (
    <StandardLayout
      title={title}
      description="À propos de Rideaux Bambou - Notre histoire et notre mission"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-16"
      >
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white lg:text-5xl">
            À Propos de Rideaux Bambou
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600 dark:text-gray-400">
            Depuis 2010, nous créons des espaces de rêve en Tunisie en combinant l'artisanat
            traditionnel avec le design contemporain.
          </p>
        </div>

        {/* Story Section */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Card className="h-full p-8">
              <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
                Notre Histoire
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400">
                <p>
                  Tout a commencé dans un petit atelier de la médina de Tunis, où notre fondateur
                  Ahmed Ben Ali a commencé à créer des rideaux en bambou pour sa propre maison. Ses
                  voisins et amis ont été immédiatement séduits par la beauté naturelle et
                  l'élégance de ses créations.
                </p>
                <p>
                  Aujourd'hui, Rideaux Bambou est devenu une référence en Tunisie pour la décoration
                  d'intérieur, avec plus de 50 boutiques à travers le pays et une équipe de 200
                  artisans passionnés.
                </p>
                <p>
                  Nous continuons à honorer nos racines artisanales tout en innovant constamment
                  pour répondre aux besoins modernes de nos clients.
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
              <img
                src="/14.jpeg"
                alt="Notre atelier"
                className="h-full w-full object-cover"
              />
            </div>
          </motion.div>
        </div>

        {/* Mission Section */}
        <Card className="p-12 text-center">
          <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">Notre Mission</h2>
          <p className="mx-auto max-w-4xl text-xl text-gray-600 dark:text-gray-400">
            "Transformer chaque espace en un havre de paix et de beauté, en combinant l'authenticité
            de l'artisanat tunisien avec l'élégance du design contemporain. Nous croyons que chaque
            maison mérite d'être un reflet de la personnalité et des rêves de ses habitants."
          </p>
        </Card>

        {/* Values Section */}
        <div>
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Nos Valeurs
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full p-6 text-center">
                  <div className="mb-4 text-4xl">{value.icon}</div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Team Section */}
        <div>
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Notre Équipe
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-6 text-center">
                  <div className="mx-auto mb-4 aspect-square h-32 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {member.name}
                  </h3>
                  <p className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {member.role}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{member.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gray-50 p-12 text-center dark:bg-gray-800">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
            Rejoignez notre aventure
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Découvrez comment nous pouvons transformer votre espace en un véritable havre de paix et
            d'élégance.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => (window.location.href = "/products")}
              className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Découvrir nos Produits
            </Button>
            <Button onClick={() => (window.location.href = "/contact")} variant="secondary">
              Nous Contacter
            </Button>
          </div>
        </Card>
      </motion.div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "À Propos - Rideaux Bambou",
    },
  };
};
