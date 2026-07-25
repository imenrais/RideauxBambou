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
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f4f6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111827" />
        <meta name="theme-color" content="#f3f4f6" />

        {/* Apply dark class before paint to avoid black/empty phone chrome flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("darkMode");var d=s==="true"||(s===null&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`,
          }}
        />

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
