import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ========================================
  // OVH CLOUD DEPLOYMENT CONFIGURATION
  // ========================================

  // Output configuration for OVH Cloud
  // Use 'standalone' for optimized Docker/PM2 deployment
  // output: "standalone", // Temporarily disabled for development

  // Enable both App Router and Pages Router
  experimental: {
    // App Router is enabled by default in Next.js 13+
  },

  // External packages for server components
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],

  // Image optimization for OVH Cloud
  images: {
    // Use remotePatterns instead of domains (Next.js 15 best practice)
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
    // Optimize for OVH Cloud bandwidth
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // TypeScript configuration - Strict for production
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration - Disabled for performance optimization
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Compression for OVH Cloud
  compress: true,

  // Power by header removal for security
  poweredByHeader: false,

  // ========================================
  // SECURITY HEADERS FOR OVH CLOUD
  // ========================================
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
            value: "", // Remove X-Powered-By header
          },
        ],
      },
    ];
  },

  // ========================================
  // REDIRECTS FOR OVH CLOUD
  // ========================================
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

  // ========================================
  // REWRITES FOR OVH CLOUD
  // ========================================
  async rewrites() {
    return [
      // Add API rewrites if needed for OVH Cloud
      // Example: proxy to external services
    ];
  },

  // ========================================
  // WEBPACK CONFIGURATION FOR OVH CLOUD
  // ========================================
  webpack: (config, { isServer }) => {
    // Optimize for OVH Cloud deployment

    // Handle node modules that need special treatment
    if (isServer) {
      config.externals = [...(config.externals || []), "@prisma/client", "bcryptjs"];
    }

    // Add any custom webpack configuration here
    return config;
  },

  // ========================================
  // PRODUCTION OPTIMIZATIONS FOR OVH CLOUD
  // ========================================
  productionBrowserSourceMaps: false, // Disable source maps in production for security
  reactStrictMode: true, // Enable React strict mode
  // Note: swcMinify is enabled by default in Next.js 15+

  // Optimize bundle size for OVH Cloud
  modularizeImports: {
    "react-icons": {
      transform: "react-icons/{{member}}",
    },
  },
};

export default nextConfig;
