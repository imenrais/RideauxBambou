import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

function notFoundRewrite(req: { url: string }) {
  // Serve the public 404 page without revealing that /admin exists.
  // Keep the browser URL as-is (rewrite, not redirect) and use HTTP 404.
  return NextResponse.rewrite(new URL("/404", req.url), { status: 404 });
}

function notFoundJson() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const authMiddleware = withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const isAdminSurface =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/upload");

    if (pathname === "/connexion" && token && token.role !== "admin") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    if (pathname === "/acces-employe" && token && token.role !== "worker") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    if (pathname === "/login" || pathname === "/worker/login" || pathname.startsWith("/worker/login/")) {
      return notFoundRewrite(req);
    }

    // Admin pages: never redirect to login — always look like a missing page.
    if (pathname.startsWith("/admin")) {
      if (!token || token.role !== "admin") {
        return notFoundRewrite(req);
      }
    }

    // Admin APIs / uploads: same not-found posture for probes.
    if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/upload")) {
      if (!token || token.role !== "admin") {
        return notFoundJson();
      }
    }

    const response = NextResponse.next();
    if (isAdminSurface || pathname === "/connexion" || pathname === "/acces-employe") {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // CRITICAL: return true for /admin* so NextAuth does NOT redirect
        // unauthenticated users to a login page.
        // The middleware body above returns a 404 rewrite instead.
        if (
          pathname.startsWith("/admin") ||
          pathname === "/login" ||
          pathname === "/worker/login" ||
          pathname.startsWith("/worker/login/") ||
          pathname.startsWith("/api/admin") ||
          pathname.startsWith("/api/upload")
        ) {
          return true;
        }

        // Allow public routes
        if (
          pathname === "/connexion" ||
          pathname === "/acces-employe" ||
          pathname.startsWith("/api/price") ||
          pathname.startsWith("/api/installation-fee") ||
          pathname.startsWith("/api/delivery-fees") ||
          pathname.startsWith("/api/pricing") ||
          pathname.startsWith("/api/products") ||
          pathname.startsWith("/api/curtain-types") ||
          pathname.startsWith("/api/curtain-models") ||
          pathname.startsWith("/api/health") ||
          pathname.startsWith("/api/newsletter") ||
          pathname.startsWith("/api/panneau-config") ||
          pathname.startsWith("/api/reviews") ||
          pathname.startsWith("/api/orders") ||
          pathname.startsWith("/api/auth") ||
          pathname === "/" ||
          pathname.startsWith("/products") ||
          pathname.startsWith("/cart") ||
          pathname.startsWith("/panier") ||
          pathname.startsWith("/paiement") ||
          pathname.startsWith("/connexion") ||
          pathname.startsWith("/inscription") ||
          pathname.startsWith("/mot-de-passe-oublie") ||
          pathname.startsWith("/reinitialiser-mot-de-passe") ||
          pathname.startsWith("/commande-reussie") ||
          pathname.startsWith("/contact") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/images/")
        ) {
          return true;
        }

        // Require authentication for other routes
        return !!token;
      },
    },
  }
);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle outside withAuth — NextAuth can error when signIn page is /404.
  if (
    pathname === "/api/auth/signin" ||
    pathname.startsWith("/api/auth/signin/") ||
    pathname === "/api/auth/error"
  ) {
    return notFoundJson();
  }

  return (authMiddleware as (req: NextRequest) => ReturnType<typeof NextResponse.next>)(req);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/upload",
    "/api/orders",
    "/api/users",
    "/api/auth/signin",
    "/api/auth/signin/:path*",
    "/api/auth/error",
    "/login",
    "/connexion",
    "/worker/login",
    "/worker/login/:path*",
    "/acces-employe",
  ],
};
