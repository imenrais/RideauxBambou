import { NextPageContext } from 'next';
import Head from 'next/head';
import { useRouter } from "next/router";

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  const router = useRouter();
  const handleBackNavigation = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    void router.push("/");
  };

  return (
    <>
      <Head>
        <title>Erreur {statusCode} - Rideaux Bambou</title>
        <meta name="description" content="Une erreur s'est produite" />
      </Head>
      
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🌿</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Oups! Une erreur s&apos;est produite
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {statusCode
              ? `Une erreur ${statusCode} s'est produite sur le serveur.`
              : "Une erreur s'est produite côté client."}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Retour à l&apos;accueil
            </button>
            <button
              onClick={() => window.location.reload()}
              className="block w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
