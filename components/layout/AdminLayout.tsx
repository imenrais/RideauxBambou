import Head from "next/head";
import { ReactNode } from "react";

import AdminNavigation from "../AdminNavigation";
import Footer from "../Footer";

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AdminLayout({
  title,
  description = "Administration - Rideaux Bambou",
  children,
}: AdminLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="icon" href="/images/logo.jpeg" />
        <link rel="apple-touch-icon" href="/images/logo.jpeg" />
      </Head>

      <div className="min-h-dvh bg-gray-100 dark:bg-gray-900">
        <AdminNavigation />

        <main className="mx-auto max-w-7xl overflow-x-clip px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>

        <Footer />
      </div>
    </>
  );
}
