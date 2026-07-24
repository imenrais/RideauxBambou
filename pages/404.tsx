import Head from "next/head";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page introuvable - Rideaux Bambou</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-stone-950">
        <div className="w-full max-w-md text-center">
          <p className="text-6xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            404
          </p>
          <h1 className="mt-4 text-xl font-medium text-stone-800 dark:text-stone-200">
            Page introuvable
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Cette page n&apos;existe pas ou a été déplacée.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </>
  );
}
