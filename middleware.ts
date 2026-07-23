import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const isAdminSurface = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    if (pathname === "/connexion" && token && token.role !== "admin") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    if (pathname === "/worker/login" && token && token.role !== "worker") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    // Admin routes protection
    if (pathname.startsWith("/admin")) {
      if (!token) {
        return NextResponse.rewrite(new URL("/404", req.url));
      }

      if (token.role !== "admin") {
        return NextResponse.rewrite(new URL("/404", req.url));
      }
    }

    // API admin routes protection
    if (pathname.startsWith("/api/admin")) {
      if (!token) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (token.role !== "admin") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const response = NextResponse.next();
    if (isAdminSurface) {
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

        // Let middleware return JSON for admin APIs instead of redirecting.
        if (pathname.startsWith("/api/admin")) {
          return true;
        }

        // Allow public routes
        if (
          pathname === "/connexion" ||
          pathname === "/worker/login" ||
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

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/orders", "/api/users", "/connexion", "/worker/login"],
};
