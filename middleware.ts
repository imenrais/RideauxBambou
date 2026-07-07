import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const isAdminSurface = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    if (pathname === "/login" && token && token.role !== "admin") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    if (pathname === "/worker/login" && token && token.role !== "worker") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    // Admin routes protection
    if (pathname.startsWith("/admin")) {
      if (!token) {
        return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
      }

      if (token.role !== "admin") {
        return NextResponse.redirect(new URL("/403", req.url));
      }
    }

    // API admin routes protection
    if (pathname.startsWith("/api/admin")) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (token.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const response = NextResponse.next();
    if (isAdminSurface) {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
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
          pathname === "/login" ||
          pathname === "/worker/login" ||
          pathname.startsWith("/api/price") ||
          pathname.startsWith("/api/installation-fee") ||
          pathname.startsWith("/api/delivery-fees") ||
          pathname.startsWith("/api/pricing") ||
          pathname.startsWith("/api/products") ||
          pathname.startsWith("/api/curtain-types") ||
          pathname.startsWith("/api/curtain-models") ||
          pathname.startsWith("/api/health") ||
          pathname.startsWith("/api/orders") ||
          pathname.startsWith("/api/auth") ||
          pathname === "/" ||
          pathname.startsWith("/products") ||
          pathname.startsWith("/cart") ||
          pathname.startsWith("/checkout") ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/signup") ||
          pathname.startsWith("/forgot-password") ||
          pathname.startsWith("/reset-password") ||
          pathname.startsWith("/order-success") ||
          pathname.startsWith("/contact") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/logo.png")
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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/orders", "/api/users", "/login", "/worker/login"],
};
