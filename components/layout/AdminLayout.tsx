import Head from "next/head";
import { ReactNode } from "react";

import AdminNavigation from "../AdminNavigation";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <AdminNavigation />

        <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </>
  );
}
