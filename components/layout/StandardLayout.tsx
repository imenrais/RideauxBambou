import Head from "next/head";
import { ReactNode } from "react";

import Footer from "../Footer";
import Navigation from "../Navigation";

interface StandardLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  showFooter?: boolean;
  showCartIcon?: boolean;
}

export default function StandardLayout({
  title,
  description = "Rideaux Bambou - Des rideaux en bambou naturels et élégants pour votre maison",
  children,
  showFooter = true,
  showCartIcon = true,
}: StandardLayoutProps) {
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
        <Navigation showCartIcon={showCartIcon} />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>

        {showFooter && <Footer />}
      </div>
    </>
  );
}
