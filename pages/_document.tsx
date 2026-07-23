import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* Meta Tags */}
        <meta
          name="description"
          content="Rideaux Bambou - Des rideaux en bambou naturels et élégants pour votre maison"
        />
        <meta name="keywords" content="rideaux, bambou, nature, décoration, maison" />
        <meta name="author" content="Rideaux Bambou" />
        <meta name="theme-color" content="#16a34a" />

        {/* Favicon and Icons */}
        <link rel="icon" href="/images/logo.png" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Rideaux Bambou" />
        <meta property="og:image" content="/images/logo.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:image" content="/images/logo.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
