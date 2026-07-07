import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import {
  clearCredentialFailures,
  enforceIpRateLimit,
  getRequestIpFromHeaders,
  isCredentialLocked,
  recordCredentialFailure,
} from "./auth-throttle";
import { prisma } from "./prisma";
import { logAuditEvent } from "./security-audit";

const isProduction = process.env.NODE_ENV === "production";
const cookiePrefix = isProduction ? "__Secure-" : "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const AUTH_IP_WINDOW_MS = 10 * 60 * 1000;
const AUTH_IP_LIMIT = 25;
const PRIVILEGED_LOGIN_MAX_FAILURES = 5;
const PRIVILEGED_LOGIN_LOCK_MS = 15 * 60 * 1000;

if (isProduction && !nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET must be set in production.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        portal: { label: "Portal", type: "text" },
      },
      async authorize(credentials, _req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        const portal = String(credentials.portal || "").toLowerCase();
        const ip = getRequestIpFromHeaders((_req as any)?.headers);

        const ipRate = enforceIpRateLimit("nextauth-login", ip, AUTH_IP_LIMIT, AUTH_IP_WINDOW_MS);
        if (!ipRate.allowed) {
          logAuditEvent({
            event: "AUTH_RATE_LIMIT_HIT",
            level: "warning",
            ip,
            details: { portal, email: normalizedEmail, retryAfterSeconds: ipRate.retryAfterSeconds },
          });
          return null;
        }

        const isPrivilegedPortal = portal === "admin" || portal === "worker";
        if (isPrivilegedPortal) {
          const lockStatus = isCredentialLocked(normalizedEmail, portal);
          if (lockStatus.locked) {
            logAuditEvent({
              event: "AUTH_LOCKOUT_BLOCKED",
              level: "warning",
              ip,
              details: {
                portal,
                email: normalizedEmail,
                retryAfterSeconds: lockStatus.retryAfterSeconds,
              },
            });
            return null;
          }
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (!user || !user.password) {
            if (isPrivilegedPortal) {
              const lockResult = recordCredentialFailure(
                normalizedEmail,
                portal,
                PRIVILEGED_LOGIN_MAX_FAILURES,
                PRIVILEGED_LOGIN_LOCK_MS
              );
              logAuditEvent({
                event: lockResult.justLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_FAILED",
                level: "warning",
                ip,
                details: {
                  portal,
                  email: normalizedEmail,
                  reason: "user_not_found_or_no_password",
                  retryAfterSeconds: lockResult.retryAfterSeconds,
                },
              });
            }
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            if (isPrivilegedPortal) {
              const lockResult = recordCredentialFailure(
                normalizedEmail,
                portal,
                PRIVILEGED_LOGIN_MAX_FAILURES,
                PRIVILEGED_LOGIN_LOCK_MS
              );
              logAuditEvent({
                event: lockResult.justLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_FAILED",
                level: "warning",
                ip,
                details: {
                  portal,
                  email: normalizedEmail,
                  reason: "invalid_password",
                  retryAfterSeconds: lockResult.retryAfterSeconds,
                },
              });
            }
            return null;
          }

          if (portal === "admin" && user.role !== "admin") {
            const lockResult = recordCredentialFailure(
              normalizedEmail,
              portal,
              PRIVILEGED_LOGIN_MAX_FAILURES,
              PRIVILEGED_LOGIN_LOCK_MS
            );
            logAuditEvent({
              event: lockResult.justLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_FAILED",
              level: "warning",
              ip,
              details: {
                portal,
                email: normalizedEmail,
                reason: "role_mismatch",
                retryAfterSeconds: lockResult.retryAfterSeconds,
              },
            });
            return null;
          }
          if (portal === "worker" && user.role !== "worker") {
            const lockResult = recordCredentialFailure(
              normalizedEmail,
              portal,
              PRIVILEGED_LOGIN_MAX_FAILURES,
              PRIVILEGED_LOGIN_LOCK_MS
            );
            logAuditEvent({
              event: lockResult.justLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_FAILED",
              level: "warning",
              ip,
              details: {
                portal,
                email: normalizedEmail,
                reason: "role_mismatch",
                retryAfterSeconds: lockResult.retryAfterSeconds,
              },
            });
            return null;
          }

          if (isPrivilegedPortal) {
            clearCredentialFailures(normalizedEmail, portal);
            logAuditEvent({
              event: "AUTH_PRIVILEGED_LOGIN_SUCCESS",
              actorId: user.id,
              actorRole: user.role,
              ip,
              details: { portal, email: normalizedEmail },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as "user" | "worker" | "admin",
            firstName: user.firstName || user.name.split(" ")[0] || user.name,
            lastName: user.lastName || user.name.split(" ").slice(1).join(" ") || "",
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
    csrfToken: {
      name: `${isProduction ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Handle Google OAuth login
      if (account?.provider === "google" && user?.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
          });

          if (!dbUser) {
            // Create new user for Google OAuth
            const fullName = user.name || user.email.split("@")[0];
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            dbUser = await prisma.user.create({
              data: {
              name: fullName,
              firstName,
              lastName,
              email: user.email.toLowerCase(),
              password: "", // No password for OAuth users
              role: "user",
              },
            });
          } else {
            // User exists - update their profile with Google data if needed
            const fullName = user.name || user.email.split("@")[0];
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Update user profile with Google data
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                name: fullName,
                firstName,
                lastName,
              },
            });
          }

          token.role = dbUser.role as "user" | "worker" | "admin";
          token.id = dbUser.id;
          token.name = dbUser.name;
          token.firstName = dbUser.firstName;
          token.lastName = dbUser.lastName;
        } catch (error) {
          console.error("Google OAuth error:", error);
        }
      }

      // Initial sign in with credentials
      if (user) {
        token.role = user.role as "user" | "worker" | "admin";
        token.id = user.id;
        token.name = user.name;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id || token.sub || "";
        session.user.role = token.role as "user" | "worker" | "admin";

        // Use token data as fallback, then fetch from database for latest data
        session.user.name = token.name || "";
        session.user.firstName = token.firstName || "";
        session.user.lastName = token.lastName || "";

        // Fetch user data to include firstName and lastName
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: String(token.id) },
          });
          if (dbUser) {
            session.user.name = dbUser.name || token.name || "";
            session.user.firstName = dbUser.firstName || token.firstName || "";
            session.user.lastName = dbUser.lastName || token.lastName || "";
            console.warn("Session callback - User data:", {
              firstName: dbUser.firstName,
              lastName: dbUser.lastName,
              name: dbUser.name,
            });
          } else {
            console.error("User not found in database for token:", token.id);
          }
        } catch (error) {
          console.error("Session error:", error);
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to home page after login
      if (url === baseUrl) return baseUrl;
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) {
        // Parse the URL and remove any credentials from query parameters
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.delete("email");
        parsedUrl.searchParams.delete("password");
        return parsedUrl.toString();
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: nextAuthSecret || "dev-only-nextauth-secret",
};
