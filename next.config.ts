import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone Node server output (see scripts/prepare-standalone.mjs)
  output: "standalone",

  experimental: {},

  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  compress: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data: blob: https: res.cloudinary.com; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-Powered-By",
            value: "",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/login",
        destination: "/connexion",
        permanent: true,
      },
      {
        source: "/signup",
        destination: "/inscription",
        permanent: true,
      },
      {
        source: "/forgot-password",
        destination: "/mot-de-passe-oublie",
        permanent: true,
      },
      {
        source: "/reset-password",
        destination: "/reinitialiser-mot-de-passe",
        permanent: true,
      },
      {
        source: "/checkout",
        destination: "/paiement",
        permanent: true,
      },
      {
        source: "/order-success",
        destination: "/commande-reussie",
        permanent: true,
      },
      {
        source: "/simple-cart",
        destination: "/panier",
        permanent: true,
      },
      {
        source: "/cart",
        destination: "/panier",
        permanent: true,
      },
      {
        source: "/profile/orders",
        destination: "/profil/commandes",
        permanent: true,
      },
      {
        source: "/boutique",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/boutique/:path*",
        destination: "/products",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@prisma/client", "bcryptjs"];
    }
    return config;
  },

  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  modularizeImports: {
    "react-icons": {
      transform: "react-icons/{{member}}",
    },
  },
};

export default nextConfig;
